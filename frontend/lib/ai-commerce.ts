export type AISettings = {
  enabled: boolean;
  mode: "off" | "copilot" | "assist";
  tone: string;
  language_preferences: string[];
  merchant_instructions: string | null;
  handoff_rules: Record<string, unknown>;
  disclose_ai: boolean;
  provider_available: boolean;
  provider: string | null;
  model: string | null;
};

export type AIToolSummary = { key: string; label: string; status: string };
export type AISuggestion = {
  id: string; execution_id: string; conversation_id: string; text: string;
  status: "suggested" | "accepted" | "rejected" | "superseded";
  tool_summary: AIToolSummary[]; accepted_at: string | null; rejected_at: string | null;
  edited_before_send: boolean; created_at: string;
};
export type AIExecution = {
  id: string; conversation_id: string; triggering_message_id: string; mode: "copilot" | "assist";
  provider: string; model: string; status: "queued" | "running" | "completed" | "handoff" | "blocked" | "failed" | "cancelled";
  started_at: string | null; completed_at: string | null; handoff_reason: string | null; failure_reason: string | null;
  input_tokens: number; output_tokens: number; tool_calls_count: number; response_message_id: string | null;
  created_at: string; tool_summary: AIToolSummary[]; suggestion: AISuggestion | null;
};
export type AIUsage = { feature: "ai_messages_monthly"; usage: number; limit: number | null; remaining: number | null; over_limit: boolean };

export function aiModeLabel(mode: AISettings["mode"]) {
  return ({ off: "Off", copilot: "Copilot", assist: "Assist" })[mode];
}

export function aiStatusMessage(execution: AIExecution) {
  if (execution.status === "handoff") return `Handed to a human${execution.handoff_reason ? `: ${execution.handoff_reason}` : ""}`;
  if (execution.status === "failed") return "AI generation failed safely. Human Inbox remains available.";
  if (execution.status === "cancelled") return "AI reply suppressed because a human took over or replied.";
  return execution.status.replaceAll("_", " ");
}

export function formatAIUsage(usage: AIUsage) {
  return usage.limit === null ? `${usage.usage} used · unlimited` : `${usage.usage} / ${usage.limit}`;
}
