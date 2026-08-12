import assert from "node:assert/strict";
import test from "node:test";

import { channelLabel, conversationName, formatInboxTime, formatReplyWindow, messageStatusLabel, providerErrorMessage, safeMessageText, type Conversation } from "../lib/inbox";

const conversation: Conversation = {
  id: "conversation-a",
  channel: { id: "channel-a", channel_type: "whatsapp", name: "Support", status: "connected", provider: "meta_whatsapp", capabilities: { text: true }, external_account_configured: true, credentials_configured: true, metadata: { display_phone_number: "+8801000000000" } },
  identity: { id: "identity-a", customer_id: null, display_name: "Asha", phone: "+8801000000000", email: null, avatar_url: null, status: "active" },
  customer_id: null,
  status: "open",
  priority: "normal",
  assigned_user_id: null,
  assigned_user_name: null,
  subject: null,
  handling_mode: "human",
  last_message_at: "2026-08-12T09:59:00Z",
  last_message_preview: "Hello",
  unread: true,
  tags: [],
  send_eligibility: { can_send_freeform: true, window_ends_at: "2026-08-13T10:00:00Z", remaining_seconds: 3660, reason: null },
};

test("conversation identity presentation has safe fallbacks", () => {
  assert.equal(conversationName(conversation), "Asha");
  assert.equal(conversationName({ ...conversation, identity: null, subject: "Order help" }), "Order help");
  assert.equal(channelLabel("facebook_messenger"), "Facebook Messenger");
});

test("Meta window and provider errors have channel-neutral presentation", () => {
  assert.equal(formatReplyWindow(3660), "1h 1m remaining");
  assert.equal(formatReplyWindow(0), "Closed");
  assert.match(providerErrorMessage("template_required"), /approved template/i);
  assert.match(providerErrorMessage("authorization_required"), /Reconnect/i);
});

test("relative Inbox timestamps remain compact", () => {
  const now = new Date("2026-08-12T10:00:00Z");
  assert.equal(formatInboxTime("2026-08-12T09:59:30Z", now), "now");
  assert.equal(formatInboxTime("2026-08-12T09:45:00Z", now), "15m");
  assert.equal(formatInboxTime("2026-08-12T07:00:00Z", now), "3h");
});

test("delivery states use provider-neutral labels", () => {
  assert.equal(messageStatusLabel("queued"), "Sending…");
  assert.equal(messageStatusLabel("delivered"), "Delivered");
  assert.equal(messageStatusLabel("failed"), "Failed");
});

test("message text remains plain and strips database-hostile NUL bytes", () => {
  assert.equal(safeMessageText("hello\0world"), "helloworld");
  assert.equal(safeMessageText(null), "");
});
