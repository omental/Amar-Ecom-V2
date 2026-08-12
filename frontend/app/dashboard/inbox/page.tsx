"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive, ArrowLeft, AtSign, Bot, Check, ChevronDown, Clock3, ExternalLink, Inbox, LoaderCircle,
  MessageCircle, PackageSearch, RefreshCw, Search, Send, Settings2, Sparkles, StickyNote, Tag, UserCheck,
  UserPlus, XCircle,
} from "lucide-react";

import { useEntitlements } from "@/components/dashboard/entitlement-provider";
import { useDashboardStore } from "@/components/dashboard/store-provider";
import { api, getErrorMessage } from "@/lib/api";
import {
  channelLabel, conversationName, formatInboxTime, formatReplyWindow, messageStatusLabel, newMessageIdempotencyKey,
  safeMessageText, type Assignee, type CommerceContext, type ConversationMessage,
  type ConversationPage, type CustomerSearchItem, type InboxProduct, type MessagingTemplate, type SavedReply, type ThreadPage,
} from "@/lib/inbox";
import { aiStatusMessage, type AIExecution } from "@/lib/ai-commerce";

const emptyThread: ThreadPage = { items: [], notes: [], total: 0, page: 1, page_size: 100 };

export default function InboxPage() {
  const { store } = useDashboardStore();
  const { can: hasEntitlement, loading: entitlementLoading } = useEntitlements();
  const [view, setView] = useState("all");
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState<ConversationPage>({ items: [], total: 0, page: 1, page_size: 30, counts: {} });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadPage>(emptyThread);
  const [context, setContext] = useState<CommerceContext | null>(null);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [savedReplies, setSavedReplies] = useState<SavedReply[]>([]);
  const [products, setProducts] = useState<InboxProduct[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [composerMode, setComposerMode] = useState<"reply" | "note">("reply");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerSearchItem[]>([]);
  const [templates, setTemplates] = useState<MessagingTemplate[]>([]);
  const [aiExecutions, setAIExecutions] = useState<AIExecution[]>([]);
  const [aiBusy, setAIBusy] = useState(false);
  const eventCursor = useRef(new Date().toISOString());

  const selected = conversations.items.find((item) => item.id === selectedId) ?? null;
  const inboxEnabled = entitlementLoading || hasEntitlement("unified_inbox");

  const loadConversations = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const params = new URLSearchParams({ view, page: "1", page_size: "30" });
      if (query.trim()) params.set("q", query.trim());
      const result = await api.get<ConversationPage>(`/admin/inbox/conversations?${params}`);
      setConversations(result);
      setSelectedId((current) => current && result.items.some((item) => item.id === current) ? current : result.items[0]?.id ?? null);
      setError(null);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Could not load the Inbox."));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [query, view]);

  const loadThread = useCallback(async (conversationId: string, quiet = false) => {
    if (!quiet) setThreadLoading(true);
    try {
      const [messages, commerce] = await Promise.all([
        api.get<ThreadPage>(`/admin/inbox/conversations/${conversationId}/messages?page=1&page_size=150`),
        api.get<CommerceContext>(`/admin/inbox/conversations/${conversationId}/commerce-context`),
        api.post<void>(`/admin/inbox/conversations/${conversationId}/read`),
      ]);
      setThread(messages);
      setContext(commerce);
      api.get<AIExecution[]>(`/admin/inbox/ai/conversations/${conversationId}/executions`).then(setAIExecutions).catch(() => setAIExecutions([]));
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Could not load this conversation."));
    } finally {
      if (!quiet) setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    eventCursor.current = new Date().toISOString();
    queueMicrotask(() => void loadConversations());
    Promise.all([
      api.get<Assignee[]>("/admin/inbox/assignees"),
      api.get<SavedReply[]>("/admin/inbox/saved-replies"),
      api.get("/admin/inbox/channels"),
    ]).then(([users, replies]) => { setAssignees(users); setSavedReplies(replies); }).catch(() => undefined);
  }, [loadConversations, store.id]);

  useEffect(() => {
    if (!selectedId) return;
    queueMicrotask(() => void loadThread(selectedId));
  }, [loadThread, selectedId]);

  useEffect(() => {
    if (selected?.channel.channel_type !== "whatsapp" || selected.send_eligibility.can_send_freeform) return;
    api.get<MessagingTemplate[]>(`/admin/inbox/meta/channels/${selected.channel.id}/templates`).then((rows) => setTemplates(rows.filter((item) => item.status === "approved"))).catch(() => setTemplates([]));
  }, [selected]);

  async function sendTemplate(template: MessagingTemplate) {
    if (!selected) return;
    const required = Math.max(0, ...template.components.flatMap((item) => Array.from((item.text || "").matchAll(/\{\{(\d+)\}\}/g), (match) => Number(match[1]))));
    const variables: string[] = [];
    for (let index = 1; index <= required; index += 1) { const value = window.prompt(`Value for {{${index}}}`); if (!value) return; variables.push(value); }
    setSending(true); try { await api.post(`/admin/inbox/conversations/${selected.id}/template`, { template_id: template.id, variables, idempotency_key: newMessageIdempotencyKey() }); await loadThread(selected.id); await loadConversations(true); } catch (sendError) { setError(getErrorMessage(sendError, "Could not send template.")); } finally { setSending(false); }
  }

  useEffect(() => {
    const interval = window.setInterval(() => {
      api.get<{ changed: boolean; cursor: string }>(`/admin/inbox/events?cursor=${encodeURIComponent(eventCursor.current)}`).then((event) => {
        eventCursor.current = event.cursor;
        if (!event.changed) return;
        void loadConversations(true);
        if (selectedId) void loadThread(selectedId, true);
      }).catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(interval);
  }, [loadConversations, loadThread, selectedId]);

  useEffect(() => {
    if (!productQuery.trim()) return;
    const timeout = window.setTimeout(() => {
      api.get<InboxProduct[]>(`/admin/inbox/products?q=${encodeURIComponent(productQuery.trim())}`).then(setProducts).catch(() => setProducts([]));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [productQuery]);

  useEffect(() => {
    if (customerQuery.trim().length < 2) return;
    const timeout = window.setTimeout(() => {
      api.get<CustomerSearchItem[]>(`/admin/inbox/customers?q=${encodeURIComponent(customerQuery.trim())}`).then(setCustomerResults).catch(() => setCustomerResults([]));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [customerQuery]);

  const timeline = useMemo(() => [
    ...thread.items.map((item) => ({ kind: "message" as const, date: item.sent_at, item })),
    ...thread.notes.map((item) => ({ kind: "note" as const, date: item.created_at, item })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [thread]);

  async function submit() {
    if (!selected || !draft.trim() || sending) return;
    setSending(true);
    try {
      if (composerMode === "note") {
        await api.post(`/admin/inbox/conversations/${selected.id}/notes`, { content: draft.trim() });
      } else if (aiExecutions[0]?.suggestion?.status === "suggested") {
        await api.post(`/admin/inbox/ai/suggestions/${aiExecutions[0].suggestion.id}/use`, { text: draft.trim(), idempotency_key: newMessageIdempotencyKey() });
      } else {
        await api.post(`/admin/inbox/conversations/${selected.id}/messages`, { text: draft.trim(), idempotency_key: newMessageIdempotencyKey() });
      }
      setDraft("");
      await Promise.all([loadThread(selected.id, true), loadConversations(true)]);
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Could not send the message."));
    } finally {
      setSending(false);
    }
  }

  async function retryMessage(message: ConversationMessage) {
    if (!selected) return;
    await api.post(`/admin/inbox/conversations/${selected.id}/messages/${message.id}/retry`);
    await loadThread(selected.id, true);
  }

  async function updateConversation(action: string, body?: unknown) {
    if (!selected) return;
    await api.post(`/admin/inbox/conversations/${selected.id}/${action}`, body);
    await loadConversations(true);
    if (action === "resolve") setSelectedId(null);
  }

  async function linkCustomer(customer: CustomerSearchItem) {
    if (!selected) return;
    await api.post(`/admin/inbox/conversations/${selected.id}/link-customer`, { customer_id: customer.id });
    setCustomerQuery("");
    setCustomerResults([]);
    await loadThread(selected.id, true);
  }

  function insertProduct(product: InboxProduct) {
    setDraft((current) => `${current}${current ? "\n" : ""}${product.name} — ${product.price}\n${product.storefront_url}`);
    setComposerMode("reply");
  }

  async function generateAIReply() {
    if (!selected) return;
    setAIBusy(true); setError(null);
    try {
      const execution = await api.post<AIExecution>(`/admin/inbox/ai/conversations/${selected.id}/generate`, { idempotency_key: crypto.randomUUID() });
      setAIExecutions((current) => [execution, ...current.filter((item) => item.id !== execution.id)]);
      if (execution.suggestion) setDraft(execution.suggestion.text);
    } catch (generationError) { setError(getErrorMessage(generationError, "Amar AI could not generate a reply.")); }
    finally { setAIBusy(false); }
  }

  async function setAIControl(action: "takeover" | "resume") {
    if (!selected) return;
    try { await api.post(`/admin/inbox/ai/conversations/${selected.id}/${action}`); await loadConversations(true); }
    catch (controlError) { setError(getErrorMessage(controlError, "Could not change AI control.")); }
  }

  return (
    <div className="-m-4 flex min-h-[calc(100vh-5rem)] flex-col md:-m-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-brd)] bg-[var(--color-surf)] px-5 py-3">
        <div><div className="flex items-center gap-2"><Inbox size={20} className="text-[var(--color-accent)]" /><h1 className="text-lg font-black">Unified Inbox</h1></div><p className="mt-0.5 text-xs text-[var(--color-txt-mut)]">Customer conversations with Store commerce context</p></div>
        <div className="flex items-center gap-2"><button type="button" onClick={() => void loadConversations()} className="rounded-xl border border-[var(--color-brd)] p-2" aria-label="Refresh Inbox"><RefreshCw size={16} /></button><Link href="/dashboard/inbox/ai" className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-brd)] px-3 py-2 text-xs font-bold"><Bot size={15} />AI Assistant</Link><Link href="/dashboard/inbox/channels" className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-brd)] px-3 py-2 text-xs font-bold"><Settings2 size={15} />Channels</Link></div>
      </header>
      {error ? <div className="flex items-center justify-between bg-red-50 px-5 py-2 text-sm text-red-700"><span>{error}</span><button onClick={() => setError(null)} aria-label="Dismiss error"><XCircle size={17} /></button></div> : null}
      {!inboxEnabled ? <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900"><strong>Inbox history is preserved.</strong> Replies and new channel activation require Unified Inbox access. <Link href="/dashboard/plan" className="font-bold underline">View plan</Link></div> : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 bg-[var(--color-surf)] lg:grid-cols-[320px_minmax(390px,1fr)_340px]">
        <aside className={`${selectedId ? "hidden lg:flex" : "flex"} min-h-0 flex-col border-r border-[var(--color-brd)]`}>
          <div className="border-b border-[var(--color-brd)] p-3">
            <div className="relative"><Search className="absolute left-3 top-2.5 text-[var(--color-txt-mut)]" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone or messages" className="w-full rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-accent)]" /></div>
            <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-[var(--color-surf-hover)] p-1">{[["mine", "Mine"], ["unassigned", "Unassigned"], ["all", "All"], ["resolved", "Resolved"]].map(([key, label]) => <button key={key} onClick={() => setView(key)} className={`rounded-lg px-1 py-2 text-[10px] font-black ${view === key ? "bg-[var(--color-surf)] text-[var(--color-accent)] shadow-sm" : "text-[var(--color-txt-mut)]"}`}>{label}</button>)}</div>
          </div>
          <div className="dashboard-scrollbar min-h-0 flex-1 overflow-y-auto">
            {loading ? <div className="flex items-center justify-center gap-2 p-10 text-sm text-[var(--color-txt-mut)]"><LoaderCircle className="animate-spin" size={17} />Loading conversations…</div> : null}
            {!loading && conversations.items.length === 0 ? <div className="px-8 py-16 text-center"><MessageCircle className="mx-auto text-[var(--color-txt-mut)]" size={30} /><h2 className="mt-3 font-bold">No conversations yet</h2><p className="mt-2 text-xs leading-5 text-[var(--color-txt-mut)]">Customer conversations from connected channels will appear here.</p></div> : null}
            {conversations.items.map((conversation) => <button key={conversation.id} onClick={() => setSelectedId(conversation.id)} className={`w-full border-b border-[var(--color-brd)] px-4 py-3 text-left transition hover:bg-[var(--color-surf-hover)] ${selectedId === conversation.id ? "bg-[color-mix(in_srgb,var(--color-accent)_7%,transparent)]" : ""}`}>
              <div className="flex items-start gap-3"><div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-surf-hover)] text-sm font-black text-[var(--color-accent)]">{conversationName(conversation).slice(0, 1).toUpperCase()}{conversation.unread ? <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--color-accent)] ring-2 ring-[var(--color-surf)]" /> : null}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className={`truncate text-sm ${conversation.unread ? "font-black" : "font-bold"}`}>{conversationName(conversation)}</p><time className="shrink-0 text-[10px] text-[var(--color-txt-mut)]">{formatInboxTime(conversation.last_message_at)}</time></div><p className="mt-1 truncate text-xs text-[var(--color-txt-mut)]">{conversation.last_message_preview || "No message preview"}</p><div className="mt-2 flex items-center gap-2 text-[9px] font-bold uppercase text-[var(--color-txt-mut)]"><AtSign size={11} />{channelLabel(conversation.channel.channel_type)}{conversation.priority !== "normal" ? <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-600">{conversation.priority}</span> : null}</div></div></div>
            </button>)}
          </div>
        </aside>

        <main className={`${selectedId ? "flex" : "hidden lg:flex"} min-h-0 flex-col border-r border-[var(--color-brd)]`}>
          {!selected ? <div className="m-auto max-w-sm px-8 text-center"><MessageCircle className="mx-auto text-[var(--color-txt-mut)]" size={40} /><h2 className="mt-4 text-lg font-black">Select a conversation</h2><p className="mt-2 text-sm text-[var(--color-txt-mut)]">Open a customer thread to reply and see its commerce context.</p></div> : <>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-brd)] px-4 py-3"><div className="flex min-w-0 items-center gap-3"><button onClick={() => setSelectedId(null)} className="lg:hidden" aria-label="Back to conversations"><ArrowLeft size={18} /></button><div className="min-w-0"><p className="truncate font-black">{conversationName(selected)}</p><p className="text-xs text-[var(--color-txt-mut)]">{channelLabel(selected.channel.channel_type)} · {selected.status} · {selected.handling_mode === "ai" ? "AI active" : "Human controlled"}</p></div></div><div className="flex items-center gap-2">{selected.handling_mode === "ai" ? <button onClick={() => void setAIControl("takeover")} className="rounded-lg border border-violet-200 px-2 py-1.5 text-xs font-bold text-violet-700">Take Over</button> : <button onClick={() => void setAIControl("resume")} className="rounded-lg border border-violet-200 px-2 py-1.5 text-xs font-bold text-violet-700">Resume AI</button>}<select value={selected.assigned_user_id ?? ""} onChange={(event) => void updateConversation("assign", { user_id: event.target.value || null })} className="max-w-36 rounded-lg border border-[var(--color-brd)] bg-transparent px-2 py-1.5 text-xs"><option value="">Unassigned</option>{assignees.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select>{selected.status === "resolved" ? <button onClick={() => void updateConversation("reopen")} className="rounded-lg border border-[var(--color-brd)] px-2 py-1.5 text-xs font-bold">Reopen</button> : <button onClick={() => void updateConversation("resolve")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1.5 text-xs font-bold text-emerald-700"><Check size={13} />Resolve</button>}</div></div>
            <div className="dashboard-scrollbar min-h-0 flex-1 overflow-y-auto bg-[var(--color-surf-hover)]/50 px-4 py-5">
              {threadLoading ? <div className="flex justify-center py-10"><LoaderCircle className="animate-spin" /></div> : null}
              <div className="space-y-3">{timeline.map((entry) => entry.kind === "note" ? <div key={`note-${entry.item.id}`} className="mx-auto max-w-[88%] rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-wide"><StickyNote size={13} />Internal note · {entry.item.author_name}</div><p className="whitespace-pre-wrap break-words">{safeMessageText(entry.item.content)}</p></div> : <div key={entry.item.id} className={`flex ${entry.item.direction === "outbound" ? "justify-end" : "justify-start"}`}><div className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${entry.item.direction === "outbound" ? "rounded-br-md bg-[var(--color-accent)] text-white" : "rounded-bl-md border border-[var(--color-brd)] bg-[var(--color-surf)]"}`}>{entry.item.sender_type === "ai" ? <div className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase text-white/80"><Bot size={11} />Amar AI</div> : null}<p className="whitespace-pre-wrap break-words">{safeMessageText(entry.item.text_content)}</p><div className={`mt-1.5 flex items-center justify-end gap-2 text-[9px] ${entry.item.direction === "outbound" ? "text-white/75" : "text-[var(--color-txt-mut)]"}`}><time>{new Date(entry.item.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>{entry.item.direction === "outbound" ? <span>{messageStatusLabel(entry.item.status)}</span> : null}</div>{entry.item.status === "failed" ? <button onClick={() => void retryMessage(entry.item)} className="mt-2 rounded bg-white/90 px-2 py-1 text-[10px] font-black text-red-700">Retry</button> : null}</div></div>)}</div>
            </div>
            <div className={`border-t p-3 ${composerMode === "note" ? "border-amber-300 bg-amber-50" : "border-[var(--color-brd)] bg-[var(--color-surf)]"}`}>
              {aiExecutions[0]?.suggestion?.status === "suggested" ? <div className="mb-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-violet-950"><div className="flex items-center justify-between"><span className="flex items-center gap-1 text-xs font-black"><Sparkles size={14} />AI Draft · not sent</span><button onClick={() => setDraft(aiExecutions[0].suggestion?.text ?? "")} className="rounded-md bg-white px-2 py-1 text-[10px] font-black">Use Draft</button></div><p className="mt-2 text-sm">{aiExecutions[0].suggestion?.text}</p><div className="mt-2 flex flex-wrap gap-1">{aiExecutions[0].suggestion?.tool_summary.map((tool) => <span key={tool.key} className="rounded bg-white px-2 py-1 text-[9px] font-bold">✓ {tool.label}</span>)}</div></div> : aiExecutions[0] && ["handoff", "failed", "cancelled"].includes(aiExecutions[0].status) ? <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">{aiStatusMessage(aiExecutions[0])}</p> : null}
              <div className="mb-2 flex items-center justify-between"><div className="inline-flex rounded-lg border border-[var(--color-brd)] bg-[var(--color-surf)] p-0.5"><button onClick={() => setComposerMode("reply")} className={`rounded-md px-3 py-1 text-xs font-black ${composerMode === "reply" ? "bg-[var(--color-accent)] text-white" : ""}`}>Reply</button><button onClick={() => setComposerMode("note")} className={`rounded-md px-3 py-1 text-xs font-black ${composerMode === "note" ? "bg-amber-400 text-amber-950" : ""}`}>Internal note</button></div><div className="relative group"><button className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-txt-mut)]">Saved replies <ChevronDown size={13} /></button><div className="invisible absolute bottom-full right-0 z-20 mb-2 w-72 rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf)] p-2 opacity-0 shadow-xl transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">{savedReplies.length ? savedReplies.map((reply) => <button key={reply.id} onClick={() => setDraft(reply.content)} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-[var(--color-surf-hover)]"><span className="block text-xs font-bold">{reply.title}</span><span className="block truncate text-[10px] text-[var(--color-txt-mut)]">{reply.content}</span></button>) : <p className="p-2 text-xs text-[var(--color-txt-mut)]">No saved replies yet.</p>}</div></div></div>
              {composerMode === "reply" ? <button onClick={() => void generateAIReply()} disabled={aiBusy || !hasEntitlement("ai_commerce")} className="mb-2 inline-flex items-center gap-1 rounded-lg border border-violet-200 px-3 py-1.5 text-xs font-black text-violet-700 disabled:opacity-40">{aiBusy ? <LoaderCircle className="animate-spin" size={13} /> : <Sparkles size={13} />}{aiExecutions[0]?.suggestion?.status === "suggested" ? "Regenerate" : "Generate Reply"}</button> : null}
              {composerMode === "note" ? <p className="mb-2 text-xs font-bold text-amber-800">Only Store staff can see internal notes. They are never sent to the customer.</p> : null}
              {composerMode === "reply" && selected.channel.channel_type === "whatsapp" ? <div className={`mb-2 rounded-lg px-3 py-2 text-xs font-bold ${selected.send_eligibility.can_send_freeform ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{selected.send_eligibility.can_send_freeform ? `Free-form reply available · ${formatReplyWindow(selected.send_eligibility.remaining_seconds)}` : "Customer-service window closed. Use an approved template."}{!selected.send_eligibility.can_send_freeform && templates.length ? <div className="mt-2 flex flex-wrap gap-2">{templates.map((template) => <button key={template.id} onClick={() => void sendTemplate(template)} className="rounded-md border border-amber-300 bg-white px-2 py-1">{template.name} · {template.language}</button>)}</div> : null}</div> : null}
              {composerMode === "reply" && selected.channel.channel_type === "facebook_messenger" && !selected.send_eligibility.can_send_freeform ? <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">The Messenger reply window is closed.</p> : null}
              <div className="flex items-end gap-2"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }} rows={3} disabled={composerMode === "reply" && !selected.send_eligibility.can_send_freeform} placeholder={composerMode === "note" ? "Add an internal note…" : "Write a reply…"} className="min-h-20 flex-1 resize-none rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] disabled:opacity-50" /><button disabled={!draft.trim() || sending || (composerMode === "reply" && (!inboxEnabled || !selected.send_eligibility.can_send_freeform))} onClick={() => void submit()} className={`flex h-11 w-11 items-center justify-center rounded-xl text-white disabled:opacity-40 ${composerMode === "note" ? "bg-amber-500" : "bg-[var(--color-accent)]"}`} aria-label={composerMode === "note" ? "Add internal note" : "Send reply"}>{sending ? <LoaderCircle className="animate-spin" size={18} /> : composerMode === "note" ? <StickyNote size={18} /> : <Send size={18} />}</button></div>
            </div>
          </>}
        </main>

        <aside className="dashboard-scrollbar hidden min-h-0 overflow-y-auto bg-[var(--color-surf)] lg:block">
          {!selected ? null : <div className="space-y-5 p-4">
            <section><div className="mb-3 flex items-center gap-2"><UserCheck size={17} className="text-[var(--color-accent)]" /><h2 className="text-sm font-black">Customer</h2></div>{context?.customer ? <div className="rounded-xl border border-[var(--color-brd)] p-3"><p className="font-black">{context.customer.name}</p><p className="mt-1 text-xs text-[var(--color-txt-mut)]">{context.customer.phone}</p><p className="text-xs text-[var(--color-txt-mut)]">{context.customer.email}</p><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-lg bg-[var(--color-surf-hover)] p-2"><p className="text-[9px] font-black uppercase text-[var(--color-txt-mut)]">Orders</p><p className="font-black">{context.customer.order_count}</p></div><div className="rounded-lg bg-[var(--color-surf-hover)] p-2"><p className="text-[9px] font-black uppercase text-[var(--color-txt-mut)]">Lifetime value</p><p className="font-black">{context.customer.lifetime_value}</p></div></div>{context.customer.notes ? <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{context.customer.notes}</p> : null}<Link href={`/dashboard/customers/${context.customer.id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--color-accent)]">Open CRM profile <ExternalLink size={12} /></Link></div> : <div className="rounded-xl border border-dashed border-[var(--color-brd)] p-3"><p className="text-xs text-[var(--color-txt-mut)]">This channel identity is not linked to a CRM customer.</p><div className="relative mt-3"><Search className="absolute left-2.5 top-2.5" size={14} /><input value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="Find customer" className="w-full rounded-lg border border-[var(--color-brd)] py-2 pl-8 pr-2 text-xs" />{customerQuery.trim().length >= 2 && customerResults.length ? <div className="absolute z-20 mt-1 w-full rounded-lg border border-[var(--color-brd)] bg-[var(--color-surf)] p-1 shadow-lg">{customerResults.map((customer) => <button key={customer.id} onClick={() => void linkCustomer(customer)} className="block w-full rounded-md p-2 text-left text-xs hover:bg-[var(--color-surf-hover)]"><strong>{customer.name}</strong><span className="block text-[10px] text-[var(--color-txt-mut)]">{customer.phone}</span></button>)}</div> : null}</div><Link href="/dashboard/customers" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--color-accent)]"><UserPlus size={13} />Create in Customers</Link></div>}</section>

            <section><div className="mb-3 flex items-center gap-2"><Archive size={17} className="text-[var(--color-accent)]" /><h2 className="text-sm font-black">Recent orders</h2></div><div className="space-y-2">{context?.recent_orders.length ? context.recent_orders.map((order) => <Link key={order.id} href={`/dashboard/orders/${order.id}`} className="block rounded-xl border border-[var(--color-brd)] p-3 hover:bg-[var(--color-surf-hover)]"><div className="flex items-center justify-between gap-2"><span className="text-xs font-black">#{order.order_number}</span><span className="rounded bg-[var(--color-surf-hover)] px-1.5 py-0.5 text-[9px] font-bold uppercase">{order.status}</span></div><p className="mt-1 text-xs text-[var(--color-txt-mut)]">{order.total} · {order.payment_status}</p></Link>) : <p className="rounded-xl border border-dashed border-[var(--color-brd)] p-3 text-xs text-[var(--color-txt-mut)]">No linked customer orders.</p>}</div></section>

            <section><div className="mb-3 flex items-center gap-2"><PackageSearch size={17} className="text-[var(--color-accent)]" /><h2 className="text-sm font-black">Products & inventory</h2></div><div className="relative"><Search className="absolute left-2.5 top-2.5" size={14} /><input value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Search products or SKU" className="w-full rounded-lg border border-[var(--color-brd)] py-2 pl-8 pr-2 text-xs" /></div><div className="mt-2 space-y-2">{productQuery.trim() ? products.map((product) => <div key={product.id} className="rounded-xl border border-[var(--color-brd)] p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-black">{product.name}</p><p className="text-[10px] text-[var(--color-txt-mut)]">{product.sku} · Stock {product.stock}</p></div><button onClick={() => insertProduct(product)} className="shrink-0 rounded-md bg-[var(--color-surf-hover)] px-2 py-1 text-[10px] font-black text-[var(--color-accent)]">Insert</button></div></div>) : null}</div></section>

            <section className="rounded-xl border border-[var(--color-brd)] p-3"><div className="flex items-center gap-2 text-xs font-bold"><Tag size={14} />Conversation controls</div><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => void updateConversation("priority", { priority: "high" })} className="rounded-lg bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-700">High priority</button><button onClick={() => void updateConversation("assign", { user_id: null })} className="rounded-lg bg-[var(--color-surf-hover)] px-2 py-1 text-[10px] font-bold">Unassign</button><button onClick={() => void updateConversation("snooze", { until: new Date(Date.now() + 3_600_000).toISOString() })} className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-surf-hover)] px-2 py-1 text-[10px] font-bold"><Clock3 size={11} />Snooze 1h</button></div></section>
          </div>}
        </aside>
      </div>
    </div>
  );
}
