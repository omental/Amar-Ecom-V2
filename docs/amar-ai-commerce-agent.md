# Amar AI Commerce Agent

## Boundary and lifecycle

Amar AI is an optional Store-scoped layer over the Unified Inbox. It does not replace messaging or commerce services:

```text
Customer message
  -> AI trigger / queued execution
  -> CommerceAIAgent
  -> AIProvider
  -> allowlisted typed tool registry
  -> existing Amar commerce data/services
  -> grounding and response policy
  -> MessagingService
  -> channel adapter
```

The model never receives an ORM session, database credentials, SQL, filesystem or shell access, an arbitrary URL fetcher, or arbitrary internal function access. `MessagingService` remains the only send authority, so Facebook Messenger and WhatsApp reply windows, connection health, capabilities, idempotency, and provider failures still apply.

## Configuration

AI configuration is environment-driven and optional:

```text
AI_PROVIDER=disabled|openai|test
AI_MODEL=gpt-5-mini
AI_API_KEY=
AI_REQUEST_TIMEOUT_SECONDS=20
AI_MAX_STEPS=6
AI_MAX_TOOL_CALLS=8
AI_MAX_OUTPUT_TOKENS=500
AI_MAX_CONTEXT_MESSAGES=12
AI_MAX_CONCURRENT_EXECUTIONS_PER_STORE=2
```

Missing credentials do not prevent Amar from starting. `test` is rejected outside development/test. API keys stay in the deployment secret store and are never persisted in tenant tables or returned to the browser. The OpenAI adapter uses the Responses API through the single `AIProvider` boundary. Provider selection requires a separate privacy/data-processing review; Amar makes no universal claim about third-party model training or retention.

## Modes and control

- **Off**: no execution. This is the migration and provisioning default.
- **Copilot**: a human explicitly requests a draft. The draft is not a conversation message and is not sent until the human uses it.
- **Assist**: safely grounded, read-only questions may be answered. Risk, ambiguity, missing evidence, quota exhaustion, provider/channel restrictions, or provider/tool failure hands control to a human.

An agent can Take Over at any time. Before an autonomous send, Amar rechecks handling state and looks for a newer human reply. A stale AI response is cancelled. Resume AI requires the management permission, enabled Store settings, and the `ai_commerce` entitlement.

## Tool registry

Every model argument is validated with a strict schema (`extra=forbid`), result counts and strings are bounded, and tool execution has a timeout. Phase 15 installs only:

- `search_products`: active, Store-scoped catalog search and canonical URL.
- `get_product`: safe product projection; descriptions are data, never instructions.
- `list_variants` / `get_variant`: real product relationships and options.
- `check_stock`: current warehouse `InventoryItem` aggregate. Exact internal quantities and warehouse details are not disclosed.
- `get_price`: current variant/product selling price and configured Store currency.
- `get_product_url`: the StoreDomain primary-domain URL service.
- `lookup_customer`: only the Customer already linked to the conversation; no enumeration.
- `lookup_order` / `get_order_status`: only an explicitly conversation-linked order or an order owned by the linked Customer.
- `get_delivery_information`: configured Store delivery rates; asks for the zone when it cannot calculate.
- `get_store_information`: configured public Store information.
- `handoff_to_agent`: controlled conversation handling state only. It sends no hidden content.

There are no tools for Order creation/modification/cancellation, refunds, payments, Customer mutation, price/inventory mutation, HR, payroll, platform billing, DNS, credentials, arbitrary code, or arbitrary network access.

## Grounding and prompt injection

System safety policy, Amar commerce rules, bounded conversation context, subordinate merchant preferences, and tool results remain separate. Customer messages, catalog descriptions, CRM text, and imported/provider metadata are all untrusted data. They cannot add tools or expand tool authority.

Autonomous stock, price, and order-status claims require corresponding same-execution evidence. URLs must come from an Amar URL tool. Current stock and price are queried again instead of relying on conversation memory. Missing or ambiguous facts produce clarification/handoff, never a fabricated value. Hidden chain-of-thought is neither stored nor shown; agents see only tool names, status, duration/usage metadata, and a safe result summary.

## Entitlement, quota, and retention

`ai_commerce` is enforced by `EntitlementService`; `ai_messages_monthly` is metered from immutable `AIUsageEvent` rows for the current paid subscription period, with a calendar-month fallback for Stores that do not yet have a billing subscription. Quota locking uses the existing commercial advisory-lock path. Losing access stops new execution but preserves settings, executions, suggestions, tool audits, messages, and the human Inbox.

`ConversationMessage` remains customer communication history. `AIExecution` stores operational metadata, not complete prompts. `AIToolCall` stores sanitized arguments and small summaries, not giant result payloads or secrets. Application/activity logs contain identifiers, provider/model, tool names, and error categories—not raw customer messages, prompts, or tool payloads.

## Async execution and operations

Meta webhook processing persists the inbound message and idempotent queued execution, commits, and acknowledges before model work. The current application uses FastAPI process-local background tasks for execution because a durable worker is not yet deployed. A server exit can leave a queued row; this is visible and replay-safe, but automated queue recovery/retry requires the planned durable worker/scheduler.

Store-level concurrent execution, bounded steps/tool calls, request/tool timeouts, inbound idempotency, execution idempotency, and outbound idempotency limit spend and duplicate replies. AI provider failure never disables the human Inbox.

## Phase 16 boundary

Phase 15 is read/respond only. Future draft-order tools must be deliberately added to the registry with transactional validation and confirmation. The present agent never claims an Order was created, altered, paid, cancelled, shipped, or refunded.
