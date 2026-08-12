# Unified Commerce Inbox

Phase 13 adds Amar's Store-scoped, channel-neutral conversation control plane. Provider integrations normalize into `MessagingChannel`, `CustomerChannelIdentity`, `Conversation`, and immutable `ConversationMessage` records. Product code does not parse Facebook, WhatsApp, Instagram, email, or website-chat payloads.

## Provider boundary

`MessagingProvider` owns outbound delivery and channel capabilities. Verified provider account mapping selects `MessagingChannel`; the channel selects the Store; processing then restores explicit tenant context before any Store-owned write. Untrusted provider requests must never choose `store_id` directly.

`TestMessagingProvider` is deterministic and permitted only in development/test. Real Meta connectors and production webhook routes are Phase 14 work. Future channel credentials use the encrypted `MessagingChannelSecret` boundary: encryption keys come from environment configuration, API responses expose only configured/masked state, and decrypted secrets remain server-side.

## Conversation lifecycle

- Provider message references are unique per channel, so webhook retries are idempotent.
- Agent sends use a client idempotency key and retain failed messages for safe retry.
- Resolved conversations reopen when a new inbound message arrives for the same external thread.
- Internal notes are separate records and never enter the provider adapter.
- Read state is per conversation and user, not a shared conversation flag.
- Assignment targets must be active members of the same Store.
- Customer and Order links are checked against the current Store.

The dashboard uses an authorized event cursor with polling fallback. Every poll and refetch carries the verified `X-Amar-Store` dashboard context. Store switching remounts the Inbox tree and discards prior Store state.

## Commerce context

The Inbox reads existing Customer, CRM activity, Order, Product, Inventory, and primary StoreDomain data. It does not duplicate those domains. Product share links are generated from the Store's canonical primary domain. Existing permission checks remain separate from the `unified_inbox` commercial entitlement.

## Privacy and operations

Messages render as plain text. Message bodies are not copied into activity logs or application logs. Activity logs record meaningful workflow events without content. Attachment tables reference the existing Media Library, but attachment upload/send APIs remain disabled until provider-specific safe download and MIME policies are implemented.

Conversation history is retained if entitlement or billing access changes. Commercial policy can restrict new replies or channel activation without deleting operational history.

## Deferred work

Phase 14 owns Facebook Messenger, WhatsApp Business, Instagram connectors, production webhook signature verification, and provider delivery callbacks. Website Chat, background delivery workers, distributed rate limiting, file ingestion, push notifications, AI replies, conversational ordering, and automation remain separate milestones.
