from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Protocol

import httpx

from app.core.config import settings


@dataclass(frozen=True, slots=True)
class AIToolRequest:
    call_id: str
    name: str
    arguments: dict[str, Any]


@dataclass(frozen=True, slots=True)
class AIProviderTurn:
    text: str | None = None
    tool_calls: tuple[AIToolRequest, ...] = ()
    input_tokens: int = 0
    output_tokens: int = 0
    provider_response_id: str | None = None


@dataclass(frozen=True, slots=True)
class AIProviderRequest:
    system_policy: str
    merchant_instructions: str
    messages: tuple[dict[str, Any], ...]
    tool_results: tuple[dict[str, Any], ...]
    tools: tuple[dict[str, Any], ...]
    max_output_tokens: int


class AIProvider(Protocol):
    key: str
    model: str

    async def generate(self, request: AIProviderRequest) -> AIProviderTurn: ...


class AIProviderError(RuntimeError):
    def __init__(self, category: str, message: str = "AI provider unavailable") -> None:
        super().__init__(message)
        self.category = category


@dataclass(slots=True)
class TestAIProvider:
    """Deterministic, scriptable provider. Direct construction is safe in tests only."""

    script: list[AIProviderTurn] = field(default_factory=list)
    key: str = "test"
    model: str = "deterministic-commerce-v1"
    calls: int = 0
    __test__ = False

    async def generate(self, request: AIProviderRequest) -> AIProviderTurn:
        self.calls += 1
        if self.script:
            return self.script.pop(0)
        customer = str(request.messages[-1].get("content", "")) if request.messages else ""
        lower = customer.lower()
        if "timeout" in lower:
            raise AIProviderError("timeout")
        if "human" in lower or "agent" in lower or "মানুষ" in customer:
            return AIProviderTurn(tool_calls=(AIToolRequest("handoff-1", "handoff_to_agent", {"reason": "Customer requested a human agent"}),))
        if not request.tool_results:
            if "order" in lower:
                return AIProviderTurn(tool_calls=(AIToolRequest("order-1", "lookup_order", {}),), input_tokens=12)
            return AIProviderTurn(tool_calls=(AIToolRequest("search-1", "search_products", {"query": customer[:120], "limit": 5}),), input_tokens=12)
        completed = {row.get("tool_key") for row in request.tool_results}
        latest = request.tool_results[-1].get("result", {})
        if "lookup_order" in completed and "get_order_status" not in completed:
            order_ref = latest.get("order_ref")
            if not order_ref:
                return AIProviderTurn(text="I couldn't verify an order for this conversation. I'll ask a team member to help.", output_tokens=16)
            return AIProviderTurn(tool_calls=(AIToolRequest("status-1", "get_order_status", {"order_ref": order_ref}),))
        if "get_order_status" in completed:
            return AIProviderTurn(text=f"Your verified order is currently {latest.get('status', 'unavailable')}.", output_tokens=12)
        if "search_products" in completed and "list_variants" not in completed:
            rows = latest.get("items", [])
            if not rows:
                return AIProviderTurn(text="I couldn't find that item in the current catalog. I'll ask a team member to help.", output_tokens=18)
            return AIProviderTurn(tool_calls=(AIToolRequest("variants-1", "list_variants", {"product_ref": rows[0]["product_ref"]}),))
        if "list_variants" in completed and "check_stock" not in completed:
            rows = latest.get("variants", [])
            if not rows:
                return AIProviderTurn(text="I found the product, but couldn't confirm that variant. Which option do you mean?", output_tokens=18)
            return AIProviderTurn(tool_calls=(
                AIToolRequest("stock-1", "check_stock", {"variant_ref": rows[0]["variant_ref"]}),
                AIToolRequest("price-1", "get_price", {"variant_ref": rows[0]["variant_ref"]}),
            ))
        if "check_stock" in completed and "get_price" in completed:
            stock = next((x["result"] for x in request.tool_results if x.get("tool_key") == "check_stock"), {})
            price = next((x["result"] for x in request.tool_results if x.get("tool_key") == "get_price"), {})
            availability = "available" if stock.get("in_stock") else "out of stock"
            return AIProviderTurn(text=f"That option is currently {availability}. The current price is {price.get('currency', '')} {price.get('amount', '')}.", output_tokens=18)
        return AIProviderTurn(text="I don't have enough confirmed information, so I'll ask a team member to help.", output_tokens=16)


class OpenAIResponsesProvider:
    key = "openai"

    def __init__(self, *, api_key: str, model: str) -> None:
        self.api_key = api_key
        self.model = model

    async def generate(self, request: AIProviderRequest) -> AIProviderTurn:
        input_items: list[dict[str, Any]] = [
            {"role": row["role"], "content": row["content"]} for row in request.messages
        ]
        for result in request.tool_results:
            input_items.append({
                "type": "function_call",
                "call_id": result["call_id"],
                "name": result["tool_key"],
                "arguments": json.dumps(result.get("arguments") or {}, separators=(",", ":"), default=str),
            })
            input_items.append({
                "type": "function_call_output",
                "call_id": result["call_id"],
                "output": json.dumps(result["result"], separators=(",", ":"), default=str),
            })
        payload = {
            "model": self.model,
            "instructions": f"{request.system_policy}\n\nMerchant preferences (subordinate):\n{request.merchant_instructions}",
            "input": input_items,
            "tools": list(request.tools),
            "max_output_tokens": request.max_output_tokens,
            "store": False,
        }
        try:
            async with httpx.AsyncClient(timeout=settings.AI_REQUEST_TIMEOUT_SECONDS) as client:
                response = await client.post(
                    "https://api.openai.com/v1/responses",
                    headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                    json=payload,
                )
            if response.status_code == 429:
                raise AIProviderError("rate_limited")
            if response.status_code >= 500:
                raise AIProviderError("provider_unavailable")
            if response.status_code >= 400:
                raise AIProviderError("invalid_request")
            data = response.json()
        except httpx.TimeoutException as exc:
            raise AIProviderError("timeout") from exc
        except httpx.HTTPError as exc:
            raise AIProviderError("provider_unavailable") from exc
        calls: list[AIToolRequest] = []
        text_parts: list[str] = []
        for item in data.get("output", []):
            if item.get("type") == "function_call":
                try:
                    arguments = json.loads(item.get("arguments") or "{}")
                except (TypeError, json.JSONDecodeError):
                    arguments = {"__malformed__": True}
                calls.append(AIToolRequest(str(item.get("call_id") or item.get("id")), str(item.get("name")), arguments))
            elif item.get("type") == "message":
                for content in item.get("content", []):
                    if content.get("type") == "output_text" and content.get("text"):
                        text_parts.append(content["text"])
        usage = data.get("usage") or {}
        return AIProviderTurn(
            text="\n".join(text_parts).strip() or None,
            tool_calls=tuple(calls),
            input_tokens=int(usage.get("input_tokens") or 0),
            output_tokens=int(usage.get("output_tokens") or 0),
            provider_response_id=data.get("id"),
        )


def configured_ai_provider() -> AIProvider:
    provider = settings.AI_PROVIDER.strip().lower()
    if provider in {"", "disabled", "none"}:
        raise AIProviderError("not_configured", "AI is not configured for this environment")
    if provider == "test":
        if settings.APP_ENV not in {"development", "test"}:
            raise AIProviderError("forbidden", "Test AI provider is forbidden in production")
        return TestAIProvider()
    if provider == "openai":
        if not settings.AI_API_KEY:
            raise AIProviderError("not_configured", "AI is not configured for this environment")
        return OpenAIResponsesProvider(api_key=settings.AI_API_KEY, model=settings.AI_MODEL)
    raise AIProviderError("not_configured", "Configured AI provider is not installed")
