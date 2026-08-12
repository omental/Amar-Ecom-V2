import assert from "node:assert/strict";
import test from "node:test";

import { aiModeLabel, aiStatusMessage, formatAIUsage, type AIExecution } from "../lib/ai-commerce";

const execution: AIExecution = {
  id: "execution-a", conversation_id: "conversation-a", triggering_message_id: "message-a",
  mode: "copilot", provider: "test", model: "deterministic-commerce-v1", status: "handoff",
  started_at: "2026-08-12T10:00:00Z", completed_at: "2026-08-12T10:00:01Z",
  handoff_reason: "Customer requested a human", failure_reason: null, input_tokens: 0,
  output_tokens: 0, tool_calls_count: 1, response_message_id: null,
  created_at: "2026-08-12T10:00:00Z", tool_summary: [], suggestion: null,
};

test("AI modes communicate the human approval boundary", () => {
  assert.equal(aiModeLabel("off"), "Off");
  assert.equal(aiModeLabel("copilot"), "Copilot");
  assert.equal(aiModeLabel("assist"), "Assist");
});

test("handoff state is actionable without exposing model reasoning", () => {
  assert.equal(aiStatusMessage(execution), "Handed to a human: Customer requested a human");
  assert.match(aiStatusMessage({ ...execution, status: "failed" }), /failed safely/i);
});

test("usage formatting distinguishes finite and unlimited quotas", () => {
  assert.equal(formatAIUsage({ feature: "ai_messages_monthly", usage: 12, limit: 100, remaining: 88, over_limit: false }), "12 / 100");
  assert.equal(formatAIUsage({ feature: "ai_messages_monthly", usage: 12, limit: null, remaining: null, over_limit: false }), "12 used · unlimited");
});
