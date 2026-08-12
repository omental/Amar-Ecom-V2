# Meta messaging

Amar's Meta integration is a transport layer over the Unified Commerce Inbox:

`Meta webhook -> verified provider asset -> MessagingChannel -> tenant_scope -> MessagingService -> ConversationMessage`

Facebook and WhatsApp do not have separate conversation or message tables. Page-scoped and phone-scoped external identities remain Store-owned, while agents work entirely through Amar permissions.

## Configuration

Configure secrets through the deployment secret manager, never source control:

- `META_APP_ID`
- `META_APP_SECRET`
- `META_GRAPH_API_VERSION`
- `META_WEBHOOK_VERIFY_TOKEN`
- `META_OAUTH_REDIRECT_URI`
- `META_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID`
- optional timeout, retry, webhook-size, event-retention, and reply-window settings

The callback URL is `/api/v1/webhooks/meta/oauth/callback`; the webhook URL is `/api/v1/webhooks/meta`. Missing configuration is non-fatal and disables connection actions. The Graph version is configured once and returned to the Embedded Signup client.

## Facebook Messenger

The merchant starts a Store/user-bound, expiring, one-time OAuth flow. Amar exchanges the authorization server-side, lists manageable Pages, and requires an explicit Page selection. It validates Page access/tasks, subscribes the Page to Messenger webhook fields, and stores only the Page identifier/name and health in channel metadata. The Page access token is stored in the existing encrypted channel credential vault.

The Page ID is globally namespaced as `facebook:{page_id}` and is the only tenant selector for inbound Messenger events. Free-form sends are checked against the provider reply window on the server. Reconnecting the same Page updates its logical channel; disconnecting removes credentials and subscription while retaining history.

## WhatsApp Business

The dashboard uses Meta Embedded Signup. Its authorization code, WABA ID, and Phone Number ID are verified again through Graph API before Amar subscribes the WABA or creates the channel. A registration PIN, when required, is submitted directly to Meta and is never logged, persisted, or returned.

Phone assets are namespaced as `whatsapp:{phone_number_id}`. Inbound text, image/document metadata, interactive replies, and unknown types normalize into the existing message model. Delivery receipts advance monotonically (`queued -> sent -> delivered -> read`); late events cannot regress state. Failed delivery never overwrites an already delivered/read state.

Within the customer-service window, agents may send text. Outside it, the backend requires an approved provider template. Template sync mirrors Meta status; pending, rejected, paused, or disabled templates cannot send. Template authoring remains with Meta in this phase.

## Webhook security and operations

GET challenge verification uses `META_WEBHOOK_VERIFY_TOKEN`. POST requests are size bounded and verified over the exact raw body with `X-Hub-Signature-256` and the app secret before any mutation. Unknown Pages/phone numbers are safely recorded/ignored and never fall back to another Store.

The provider event inbox deduplicates event keys and retains only the normalized fields needed for safe replay (including bounded text for failed message ingestion), rather than the complete raw Meta envelope. Retention is configurable (30 days by default); production cleanup needs a durable scheduled worker. Failed-event inspection/replay requires platform-admin authorization and re-enters the mapped Store's tenant scope.

## Credential and privacy boundary

Tokens are encrypted at rest with Amar's credential-vault key and decrypted only inside adapters. Merchant APIs expose masked configuration/health only. `inbox.reply` permits replying but does not grant `inbox.channels`; ordinary agents cannot connect, disconnect, or retrieve tokens. Message bodies are not copied into activity/general logs. Internal notes never invoke a provider adapter.

## Production prerequisites

Production connectivity requires a Meta app with the applicable products, business verification, App Review/Advanced Access, Page permissions (`pages_show_list`, `pages_messaging`, and `pages_manage_metadata` as applicable), a publicly reachable HTTPS callback/webhook, and valid WABA/phone assets. Configure the webhook verification token and subscribe the Page/WABA to the supported fields.

The deterministic Meta Graph adapter only runs when `APP_ENV=test`; the Phase 13 test messaging provider is limited to development/test. Neither can be selected by production configuration.

Production media ingestion, durable webhook workers, App Review certification, and real controlled-asset QA remain deployment work. Provider-authenticated media URLs must never be returned to browsers; this phase stores safe attachment metadata and defers authenticated media download/storage.
