import type { OnlineStorePage, OnlineStoreSection } from "@/lib/online-store";
import { normalizeStyleSet, type BuilderStyleSet } from "@/lib/storefront-builder-style";

export type BuilderDevice = "desktop" | "tablet" | "mobile";
export type BuilderBlockType = "div" | "container" | "stack" | "grid" | "heading" | "paragraph" | "image" | "button" | "spacer" | "divider" | "query_loop" | "product_title" | "product_media" | "product_price" | "product_compare_price" | "product_description" | "product_sku" | "product_brand" | "product_availability" | "variant_selector" | "quantity_selector" | "add_to_cart" | "collection_title" | "collection_description" | "collection_image";
export type BuilderResponsiveValue = Record<string, unknown>;

export type BuilderBlock = {
  id: string;
  type: BuilderBlockType | string;
  column: number;
  props: Record<string, unknown>;
  style: BuilderStyleSet;
  responsive: Record<BuilderDevice, BuilderResponsiveValue>;
  class_ids: string[];
  meta: { label?: string; locked?: boolean; hidden?: boolean };
  children: BuilderBlock[];
};

export const MAX_BUILDER_DEPTH = 12;
const RESERVED_BLOCK_KEYS = new Set(["id", "type", "column", "props", "style", "responsive", "children", "class_ids", "classes", "meta"]);

export function createBuilderNodeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const value = Math.floor(Math.random() * 16);
    return (token === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

export function asBuilderRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeBlock(value: unknown, seenIds: Set<string>, visited: WeakSet<object>, depth: number): BuilderBlock {
  const source = asBuilderRecord(value);
  const legacyProps = Object.fromEntries(Object.entries(source).filter(([key]) => !RESERVED_BLOCK_KEYS.has(key)));
  const responsive = asBuilderRecord(source.responsive);
  const requestedId = typeof source.id === "string" && source.id ? source.id : createBuilderNodeId();
  const id = seenIds.has(requestedId) ? createBuilderNodeId() : requestedId;
  seenIds.add(id);

  const sourceObject = value && typeof value === "object" ? value as object : null;
  const circular = sourceObject ? visited.has(sourceObject) : false;
  if (sourceObject && !circular) visited.add(sourceObject);
  const children = !circular && depth < MAX_BUILDER_DEPTH && Array.isArray(source.children)
    ? source.children.map((child) => normalizeBlock(child, seenIds, visited, depth + 1))
    : [];
  if (sourceObject && !circular) visited.delete(sourceObject);

  return {
    id,
    type: typeof source.type === "string" && source.type ? source.type : "paragraph",
    column: Math.max(1, Number(source.column) || 1),
    props: { ...legacyProps, ...asBuilderRecord(source.props) },
    style: normalizeStyleSet(source.style),
    responsive: {
      desktop: asBuilderRecord(responsive.desktop),
      tablet: asBuilderRecord(responsive.tablet),
      mobile: asBuilderRecord(responsive.mobile),
    },
    class_ids: (() => {
      const values = Array.isArray(source.class_ids) ? source.class_ids : Array.isArray(source.classes) ? source.classes : [];
      return values.filter((item): item is string => typeof item === "string");
    })(),
    meta: { label: typeof asBuilderRecord(source.meta).label === "string" ? String(asBuilderRecord(source.meta).label) : undefined, locked: asBuilderRecord(source.meta).locked === true, hidden: asBuilderRecord(source.meta).hidden === true },
    children,
  };
}

export function normalizeBuilderBlocks(values: unknown[]): BuilderBlock[] {
  const seenIds = new Set<string>();
  const visited = new WeakSet<object>();
  return values.map((value) => normalizeBlock(value, seenIds, visited, 0));
}

export function normalizeBuilderBlock(value: unknown): BuilderBlock {
  return normalizeBuilderBlocks([value])[0];
}

export function normalizeSectionBlocks(section: OnlineStoreSection): OnlineStoreSection {
  if (section.type !== "flexible_grid") return section;
  const content = asBuilderRecord(section.content);
  const blocks = Array.isArray(content.blocks) ? normalizeBuilderBlocks(content.blocks) : [];
  return { ...section, content: { ...content, blocks } };
}

export function normalizeBuilderPage(page: OnlineStorePage): OnlineStorePage {
  return { ...page, sections: page.sections.map(normalizeSectionBlocks) };
}

export function getBuilderBlocks(section: OnlineStoreSection): BuilderBlock[] {
  const blocks = asBuilderRecord(section.content).blocks;
  return Array.isArray(blocks) ? normalizeBuilderBlocks(blocks) : [];
}

function stableBlockHash(value: unknown) {
  const input = JSON.stringify(value) || "block";
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizeRenderableBlock(value: unknown, fallbackId: string, depth: number): BuilderBlock {
  const source = asBuilderRecord(value);
  const normalized = normalizeBuilderBlock({ ...source, id: typeof source.id === "string" && source.id ? source.id : fallbackId, children: [] });
  const childCounts = new Map<string, number>();
  const children = depth < MAX_BUILDER_DEPTH && Array.isArray(source.children) ? source.children.map((child) => {
    const hash = stableBlockHash(child);
    const occurrence = childCounts.get(hash) || 0;
    childCounts.set(hash, occurrence + 1);
    return normalizeRenderableBlock(child, `${normalized.id}-${hash}-${occurrence}`, depth + 1);
  }) : [];
  return { ...normalized, children };
}

/** Read-only normalization for public rendering; legacy fallback keys are deterministic. */
export function getRenderableBuilderBlocks(section: OnlineStoreSection): BuilderBlock[] {
  const blocks = asBuilderRecord(section.content).blocks;
  const sectionSeed = section.id || `${section.type}-${section.sort_order || 0}`;
  const counts = new Map<string, number>();
  return Array.isArray(blocks) ? blocks.map((block) => {
    const hash = stableBlockHash(block);
    const occurrence = counts.get(hash) || 0;
    counts.set(hash, occurrence + 1);
    return normalizeRenderableBlock(block, `legacy-${sectionSeed}-${hash}-${occurrence}`, 0);
  }) : [];
}

export function getBlockProps(block: BuilderBlock | Record<string, unknown>) {
  const source = block as Record<string, unknown>;
  return { ...Object.fromEntries(Object.entries(source).filter(([key]) => !RESERVED_BLOCK_KEYS.has(key))), ...asBuilderRecord(source.props) };
}

export function cloneBlockWithNewIds(block: BuilderBlock): BuilderBlock {
  return { ...structuredClone(block), id: createBuilderNodeId(), children: block.children.map(cloneBlockWithNewIds) };
}

export function cloneSectionWithNewBlockIds(section: OnlineStoreSection): OnlineStoreSection {
  const normalized = normalizeSectionBlocks(section);
  if (normalized.type !== "flexible_grid") return structuredClone(normalized);
  const content = asBuilderRecord(normalized.content);
  return { ...structuredClone(normalized), id: undefined, content: { ...content, blocks: getBuilderBlocks(normalized).map(cloneBlockWithNewIds) } };
}

export function findBuilderBlock(blocks: BuilderBlock[], id: string): BuilderBlock | null {
  for (const block of blocks) {
    if (block.id === id) return block;
    const nested = findBuilderBlock(block.children, id);
    if (nested) return nested;
  }
  return null;
}

export function updateBuilderBlock(blocks: BuilderBlock[], id: string, updater: (block: BuilderBlock) => BuilderBlock): BuilderBlock[] {
  return blocks.map((block) => block.id === id ? updater(block) : { ...block, children: updateBuilderBlock(block.children, id, updater) });
}

export function removeBuilderBlock(blocks: BuilderBlock[], id: string): BuilderBlock[] {
  return blocks.filter((block) => block.id !== id).map((block) => ({ ...block, children: removeBuilderBlock(block.children, id) }));
}

export function flattenBuilderBlocks(blocks: BuilderBlock[]): BuilderBlock[] {
  return blocks.flatMap((block) => [block, ...flattenBuilderBlocks(block.children)]);
}
