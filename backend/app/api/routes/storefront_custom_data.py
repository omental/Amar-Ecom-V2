from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, require_entitlement
from app.api.utils import commit_or_409, fetch_one_or_404
from app.models.category import Category
from app.models.product import Product, ProductVariant
from app.models.storefront import (
    StorefrontContentEntry, StorefrontContentFieldDefinition, StorefrontContentModel,
    StorefrontCustomFieldDefinition, StorefrontCustomFieldValue, StorefrontPage, StorefrontSavedSection, StorefrontSection,
)
from app.schemas.storefront_custom_data import (
    ContentEntryCreate, ContentEntryRead, ContentEntryUpdate, ContentFieldCreate,
    ContentModelCreate, ContentModelRead, ContentModelUpdate, CustomFieldDefinitionCreate,
    CustomFieldDefinitionRead, CustomFieldDefinitionUpdate, CustomFieldValueRead, CustomFieldValueWrite,
)
from app.services.storefront_custom_data_service import validate_custom_value, validate_entry_values

router = APIRouter()

OWNER_MODELS = {"product": Product, "product_variant": ProductVariant, "collection": Category, "page": StorefrontPage}


def _uses_dynamic_field(value: object, root: str, field_key: str) -> bool:
    if isinstance(value, list): return any(_uses_dynamic_field(item, root, field_key) for item in value)
    if not isinstance(value, dict): return False
    source = value.get("source")
    path = source.get("path") if isinstance(source, dict) else None
    if value.get("kind") == "dynamic" and isinstance(source, dict) and source.get("root") == root and isinstance(path, list) and path[:2] == ["custom_fields", field_key]: return True
    return any(_uses_dynamic_field(item, root, field_key) for item in value.values())


async def _ensure_owner(db: DBSession, owner_type: str, owner_id: UUID) -> None:
    model = OWNER_MODELS.get(owner_type)
    if model is None or await db.get(model, owner_id) is None:
        raise HTTPException(status_code=404, detail="Custom field owner not found")


@router.get("/custom-fields", response_model=list[CustomFieldDefinitionRead])
async def list_definitions(db: DBSession, owner_type: str | None = None):
    stmt = select(StorefrontCustomFieldDefinition).order_by(StorefrontCustomFieldDefinition.owner_type, StorefrontCustomFieldDefinition.name)
    if owner_type: stmt = stmt.where(StorefrontCustomFieldDefinition.owner_type == owner_type)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/custom-fields", response_model=CustomFieldDefinitionRead, status_code=201, dependencies=[Depends(require_entitlement("custom_fields"))])
async def create_definition(payload: CustomFieldDefinitionCreate, db: DBSession):
    exists = await db.scalar(select(StorefrontCustomFieldDefinition.id).where(StorefrontCustomFieldDefinition.owner_type == payload.owner_type, StorefrontCustomFieldDefinition.namespace == payload.namespace, StorefrontCustomFieldDefinition.key == payload.key))
    if exists: raise HTTPException(status_code=409, detail="Custom field key already exists for this owner type")
    item = StorefrontCustomFieldDefinition(**payload.model_dump())
    db.add(item); await commit_or_409(db, "Could not create custom field"); await db.refresh(item)
    return item


@router.patch("/custom-fields/{definition_id}", response_model=CustomFieldDefinitionRead, dependencies=[Depends(require_entitlement("custom_fields"))])
async def update_definition(definition_id: UUID, payload: CustomFieldDefinitionUpdate, db: DBSession):
    item = await fetch_one_or_404(db, select(StorefrontCustomFieldDefinition).where(StorefrontCustomFieldDefinition.id == definition_id), "Custom field not found")
    data = payload.model_dump(exclude_unset=True)
    if data.get("value_type") and data["value_type"] != item.value_type:
        count = await db.scalar(select(func.count(StorefrontCustomFieldValue.id)).where(StorefrontCustomFieldValue.definition_id == item.id))
        if count: raise HTTPException(status_code=409, detail="Field type cannot change while values exist")
    for key, value in data.items(): setattr(item, key, value)
    await commit_or_409(db, "Could not update custom field"); await db.refresh(item); return item


@router.delete("/custom-fields/{definition_id}", status_code=204, dependencies=[Depends(require_entitlement("custom_fields"))])
async def delete_definition(definition_id: UUID, db: DBSession):
    item = await fetch_one_or_404(db, select(StorefrontCustomFieldDefinition).where(StorefrontCustomFieldDefinition.id == definition_id), "Custom field not found")
    count = await db.scalar(select(func.count(StorefrontCustomFieldValue.id)).where(StorefrontCustomFieldValue.definition_id == item.id))
    if count: raise HTTPException(status_code=409, detail="Remove resource values before deleting this field")
    root = "collection" if item.owner_type == "collection" else item.owner_type
    field_key = f"{item.namespace}.{item.key}"
    sections = (await db.execute(select(StorefrontSection.content))).scalars().all()
    saved = (await db.execute(select(StorefrontSavedSection.snapshot))).scalars().all()
    if any(_uses_dynamic_field(content, root, field_key) for content in [*sections, *saved]): raise HTTPException(status_code=409, detail="Remove storefront dynamic bindings before deleting this field")
    await db.delete(item); await commit_or_409(db, "Could not delete custom field"); return Response(status_code=204)


@router.get("/custom-field-values/{owner_type}/{owner_id}", response_model=list[CustomFieldValueRead])
async def list_values(owner_type: str, owner_id: UUID, db: DBSession):
    await _ensure_owner(db, owner_type, owner_id)
    return list((await db.execute(select(StorefrontCustomFieldValue).where(StorefrontCustomFieldValue.owner_type == owner_type, StorefrontCustomFieldValue.owner_id == owner_id))).scalars().all())


@router.put("/custom-field-values/{owner_type}/{owner_id}", response_model=list[CustomFieldValueRead], dependencies=[Depends(require_entitlement("custom_fields"))])
async def write_values(owner_type: str, owner_id: UUID, payload: list[CustomFieldValueWrite], db: DBSession):
    await _ensure_owner(db, owner_type, owner_id)
    output = []
    for incoming in payload:
        definition = await db.get(StorefrontCustomFieldDefinition, incoming.definition_id)
        if definition is None or definition.owner_type != owner_type: raise HTTPException(status_code=422, detail="Custom field is incompatible with this resource")
        value = validate_custom_value(incoming.value, definition.value_type, definition.validation, definition.is_required)
        if definition.value_type == "reference" and value:
            reference = value
            expected = definition.validation.get("reference_model_key")
            if expected and reference["model_key"] != expected: raise HTTPException(status_code=422, detail="Reference uses an incompatible content model")
            exists = await db.scalar(select(StorefrontContentEntry.id).join(StorefrontContentModel).where(StorefrontContentModel.key == reference["model_key"], StorefrontContentEntry.handle == reference["entry_handle"]))
            if not exists: raise HTTPException(status_code=422, detail="Referenced content entry does not exist")
        item = await db.scalar(select(StorefrontCustomFieldValue).where(StorefrontCustomFieldValue.definition_id == definition.id, StorefrontCustomFieldValue.owner_id == owner_id))
        if value is None:
            if item is not None: await db.delete(item)
            continue
        if item is None: item = StorefrontCustomFieldValue(definition_id=definition.id, owner_type=owner_type, owner_id=owner_id); db.add(item)
        item.value = value; output.append(item)
    await commit_or_409(db, "Could not save custom field values")
    for item in output: await db.refresh(item)
    return output


def _model_stmt():
    return select(StorefrontContentModel).options(selectinload(StorefrontContentModel.fields)).order_by(StorefrontContentModel.name)


@router.get("/content-models", response_model=list[ContentModelRead])
async def list_models(db: DBSession): return list((await db.execute(_model_stmt())).scalars().unique().all())


@router.post("/content-models", response_model=ContentModelRead, status_code=201, dependencies=[Depends(require_entitlement("content_models"))])
async def create_model(payload: ContentModelCreate, db: DBSession):
    if await db.scalar(select(StorefrontContentModel.id).where(StorefrontContentModel.key == payload.key)): raise HTTPException(status_code=409, detail="Content model key already exists")
    item = StorefrontContentModel(name=payload.name, key=payload.key, description=payload.description); db.add(item); await db.flush()
    for field in payload.fields: db.add(StorefrontContentFieldDefinition(model_id=item.id, **field.model_dump()))
    await commit_or_409(db, "Could not create content model")
    return (await db.execute(_model_stmt().where(StorefrontContentModel.id == item.id))).scalar_one()


@router.patch("/content-models/{model_id}", response_model=ContentModelRead, dependencies=[Depends(require_entitlement("content_models"))])
async def update_model(model_id: UUID, payload: ContentModelUpdate, db: DBSession):
    item = await fetch_one_or_404(db, select(StorefrontContentModel).where(StorefrontContentModel.id == model_id), "Content model not found")
    for key, value in payload.model_dump(exclude_unset=True).items(): setattr(item, key, value)
    await commit_or_409(db, "Could not update content model")
    return (await db.execute(_model_stmt().where(StorefrontContentModel.id == item.id))).scalar_one()


@router.delete("/content-models/{model_id}", status_code=204, dependencies=[Depends(require_entitlement("content_models"))])
async def delete_model(model_id: UUID, db: DBSession):
    item = await fetch_one_or_404(db, select(StorefrontContentModel).options(selectinload(StorefrontContentModel.entries)).where(StorefrontContentModel.id == model_id), "Content model not found")
    references = (await db.execute(select(StorefrontCustomFieldDefinition).where(StorefrontCustomFieldDefinition.value_type == "reference"))).scalars().all()
    if item.entries or any(field.validation.get("reference_model_key") == item.key for field in references):
        raise HTTPException(status_code=409, detail="Remove entries and reference fields before deleting this content model")
    await db.delete(item); await commit_or_409(db, "Could not delete content model"); return Response(status_code=204)


@router.post("/content-models/{model_id}/fields", response_model=ContentModelRead, dependencies=[Depends(require_entitlement("content_models"))])
async def add_model_field(model_id: UUID, payload: ContentFieldCreate, db: DBSession):
    await fetch_one_or_404(db, select(StorefrontContentModel).where(StorefrontContentModel.id == model_id), "Content model not found")
    db.add(StorefrontContentFieldDefinition(model_id=model_id, **payload.model_dump())); await commit_or_409(db, "Could not add content field")
    return (await db.execute(_model_stmt().where(StorefrontContentModel.id == model_id))).scalar_one()


@router.get("/content-models/{model_id}/entries", response_model=list[ContentEntryRead])
async def list_entries(model_id: UUID, db: DBSession):
    return list((await db.execute(select(StorefrontContentEntry).where(StorefrontContentEntry.model_id == model_id).order_by(StorefrontContentEntry.handle))).scalars().all())


@router.post("/content-models/{model_id}/entries", response_model=ContentEntryRead, status_code=201, dependencies=[Depends(require_entitlement("content_models"))])
async def create_entry(model_id: UUID, payload: ContentEntryCreate, db: DBSession):
    await fetch_one_or_404(db, select(StorefrontContentModel).where(StorefrontContentModel.id == model_id), "Content model not found")
    values = await validate_entry_values(db, model_id, payload.values)
    item = StorefrontContentEntry(model_id=model_id, handle=payload.handle, values=values, status=payload.status); db.add(item)
    await commit_or_409(db, "Could not create content entry"); await db.refresh(item); return item


@router.patch("/content-entries/{entry_id}", response_model=ContentEntryRead, dependencies=[Depends(require_entitlement("content_models"))])
async def update_entry(entry_id: UUID, payload: ContentEntryUpdate, db: DBSession):
    item = await fetch_one_or_404(db, select(StorefrontContentEntry).where(StorefrontContentEntry.id == entry_id), "Content entry not found")
    data = payload.model_dump(exclude_unset=True)
    if "values" in data: data["values"] = await validate_entry_values(db, item.model_id, data["values"])
    for key, value in data.items(): setattr(item, key, value)
    await commit_or_409(db, "Could not update content entry"); await db.refresh(item); return item


@router.delete("/content-entries/{entry_id}", status_code=204, dependencies=[Depends(require_entitlement("content_models"))])
async def delete_entry(entry_id: UUID, db: DBSession):
    item = await fetch_one_or_404(db, select(StorefrontContentEntry).options(selectinload(StorefrontContentEntry.model)).where(StorefrontContentEntry.id == entry_id), "Content entry not found")
    values = (await db.execute(select(StorefrontCustomFieldValue).join(StorefrontCustomFieldDefinition).where(StorefrontCustomFieldDefinition.value_type == "reference"))).scalars().all()
    if any(isinstance(value.value, dict) and value.value.get("model_key") == item.model.key and value.value.get("entry_handle") == item.handle for value in values):
        raise HTTPException(status_code=409, detail="This content entry is referenced by resource custom fields")
    await db.delete(item); await commit_or_409(db, "Could not delete content entry"); return Response(status_code=204)
