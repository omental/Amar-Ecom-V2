"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Camera, CheckCircle2, FlaskConical, MessageCircle, RefreshCw, ShieldCheck, Unplug } from "lucide-react";

import { useEntitlements } from "@/components/dashboard/entitlement-provider";
import { useDashboardStore } from "@/components/dashboard/store-provider";
import { api, getErrorMessage } from "@/lib/api";
import { channelLabel, type InboxChannel } from "@/lib/inbox";

type MetaConfig = { configured: boolean; facebook_configured: boolean; whatsapp_configured: boolean; message: string | null; app_id: string | null; embedded_signup_config_id: string | null; graph_api_version: string | null };
type FacebookPage = { id: string; name: string };
type FacebookSdk = { init(options: Record<string, unknown>): void; login(callback: (result: { authResponse?: { code?: string } }) => void, options: Record<string, unknown>): void };

export default function InboxChannelsPage() {
  const { store } = useDashboardStore();
  const query = useSearchParams();
  const { can, loading: entitlementLoading } = useEntitlements();
  const [channels, setChannels] = useState<InboxChannel[]>([]);
  const [config, setConfig] = useState<MetaConfig | null>(null);
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [channelRows, meta] = await Promise.all([api.get<InboxChannel[]>("/admin/inbox/channels"), api.get<MetaConfig>("/admin/inbox/meta/configuration")]);
    setChannels(channelRows); setConfig(meta);
  }, []);

  useEffect(() => { queueMicrotask(() => refresh().catch((error) => setMessage(getErrorMessage(error, "Could not load channels.")))); }, [refresh, store.id]);
  useEffect(() => {
    if (!config?.app_id || document.getElementById("meta-jssdk")) return;
    const script = document.createElement("script"); script.id = "meta-jssdk"; script.async = true; script.defer = true; script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.onload = () => (window as typeof window & { FB?: FacebookSdk }).FB?.init({ appId: config.app_id, cookie: true, xfbml: false, version: config.graph_api_version });
    document.body.appendChild(script);
  }, [config?.app_id, config?.graph_api_version]);
  useEffect(() => {
    const flow = query.get("facebook_flow");
    if (flow) api.get<FacebookPage[]>(`/admin/inbox/meta/facebook/oauth/${flow}/pages`).then(setPages).catch((error) => setMessage(getErrorMessage(error, "Facebook authorization expired.")));
  }, [query]);

  async function startFacebook() {
    setBusy("facebook"); setMessage(null);
    try { const result = await api.post<{ authorization_url: string }>("/admin/inbox/meta/facebook/oauth/start"); window.location.assign(result.authorization_url); }
    catch (error) { setMessage(getErrorMessage(error, "Could not start Facebook authorization.")); setBusy(null); }
  }

  async function selectPage(pageId: string) {
    const flowId = query.get("facebook_flow"); if (!flowId) return;
    setBusy(pageId);
    try { await api.post("/admin/inbox/meta/facebook/connect", { flow_id: flowId, page_id: pageId }); setPages([]); await refresh(); window.history.replaceState({}, "", "/dashboard/inbox/channels"); }
    catch (error) { setMessage(getErrorMessage(error, "Could not connect this Page.")); } finally { setBusy(null); }
  }

  async function connectWhatsApp() {
    if (!config?.app_id || !config.embedded_signup_config_id) return;
    setBusy("whatsapp"); setMessage("Complete Embedded Signup in the Meta window.");
    const sdk = (window as typeof window & { FB?: FacebookSdk }).FB;
    if (!sdk) { setMessage("Meta Embedded Signup SDK is not loaded. Check the Meta deployment configuration."); setBusy(null); return; }
    let session: { waba_id?: string; phone_number_id?: string } = {};
    const listener = (event: MessageEvent) => { if (!event.origin.endsWith("facebook.com")) return; try { const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data; if (data?.type === "WA_EMBEDDED_SIGNUP" && data?.event === "FINISH") session = data.data || {}; } catch { /* ignore unrelated messages */ } };
    window.addEventListener("message", listener);
    sdk.login(async (result) => {
      window.removeEventListener("message", listener);
      try {
        if (!result.authResponse?.code || !session.waba_id || !session.phone_number_id) throw new Error("Embedded Signup did not return verified WhatsApp assets.");
        await api.post("/admin/inbox/meta/whatsapp/connect", { code: result.authResponse.code, waba_id: session.waba_id, phone_number_id: session.phone_number_id });
        await refresh(); setMessage("WhatsApp Business connected.");
      } catch (error) { setMessage(getErrorMessage(error, error instanceof Error ? error.message : "Could not connect WhatsApp.")); } finally { setBusy(null); }
    }, { config_id: config.embedded_signup_config_id, response_type: "code", override_default_response_type: true, extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" } });
  }

  async function disconnect(channel: InboxChannel) {
    if (!window.confirm(`Disconnect ${channel.name}? Conversation history will be preserved.`)) return;
    setBusy(channel.id); try { await api.post(`/admin/inbox/meta/channels/${channel.id}/disconnect`); await refresh(); } catch (error) { setMessage(getErrorMessage(error, "Could not disconnect channel.")); } finally { setBusy(null); }
  }

  async function syncTemplates(channel: InboxChannel) {
    setBusy(channel.id); try { await api.post(`/admin/inbox/meta/channels/${channel.id}/templates/sync`); await refresh(); setMessage("WhatsApp templates synchronized."); } catch (error) { setMessage(getErrorMessage(error, "Template sync failed.")); } finally { setBusy(null); }
  }

  const connectedTypes = new Set(channels.filter((item) => item.status !== "disconnected").map((item) => item.channel_type));
  const enabled = entitlementLoading || can("unified_inbox");
  return <div className="space-y-6">
    <div className="flex items-start justify-between gap-4"><div><Link href="/dashboard/inbox" className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--color-accent)]"><ArrowLeft size={14} />Back to Inbox</Link><h1 className="text-2xl font-black">Inbox Channels</h1><p className="mt-2 text-sm text-[var(--color-txt-sec)]">Connect provider assets once. Agents answer using Amar permissions—never provider credentials.</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${enabled ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{enabled ? "Inbox included" : "Locked by plan"}</span></div>
    {message ? <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{message}</div> : null}
    {pages.length ? <section className="card-base p-5"><h2 className="font-black">Select Facebook Page</h2><p className="mt-1 text-xs text-[var(--color-txt-mut)]">Only the Page you select will be connected.</p><div className="mt-4 grid gap-2">{pages.map((page) => <button key={page.id} onClick={() => void selectPage(page.id)} disabled={busy !== null} className="flex items-center justify-between rounded-xl border border-[var(--color-brd)] p-3 text-left font-bold hover:bg-[var(--color-surf-hover)]"><span>{page.name}</span><span className="text-xs text-[var(--color-accent)]">{busy === page.id ? "Connecting…" : "Connect"}</span></button>)}</div></section> : null}
    <section className="grid gap-4 lg:grid-cols-2">
      {channels.map((channel) => <article key={channel.id} className="card-base p-5"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="rounded-xl bg-violet-50 p-3 text-violet-700">{channel.provider === "test" ? <FlaskConical size={20} /> : <MessageCircle size={20} />}</div><div><h2 className="font-black">{channel.name}</h2><p className="text-xs text-[var(--color-txt-mut)]">{channelLabel(channel.channel_type)}</p></div></div><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${channel.status === "connected" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}><CheckCircle2 size={12} />{channel.status.replaceAll("_", " ")}</span></div><dl className="mt-4 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-[var(--color-txt-mut)]">Asset</dt><dd className="font-bold">{channel.metadata.page_name || channel.metadata.display_phone_number || "Development adapter"}</dd></div><div><dt className="text-[var(--color-txt-mut)]">Webhook</dt><dd className="font-bold">{channel.metadata.webhook_subscription || "Local"}</dd></div></dl><div className="mt-4 flex flex-wrap gap-2">{channel.channel_type === "whatsapp" && channel.status === "connected" ? <button onClick={() => void syncTemplates(channel)} disabled={busy !== null} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold"><RefreshCw size={13} />Sync templates</button> : null}{channel.provider.startsWith("meta_") && channel.status !== "disconnected" ? <button onClick={() => void disconnect(channel)} disabled={busy !== null} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700"><Unplug size={13} />Disconnect</button> : null}</div></article>)}
      {!connectedTypes.has("facebook_messenger") ? <article className="card-base p-5"><MessageCircle className="text-blue-600" /><h2 className="mt-3 font-black">Facebook Messenger</h2><p className="mt-1 text-sm text-[var(--color-txt-sec)]">Connect your Facebook Page and answer Messenger customers from Amar.</p><button onClick={() => void startFacebook()} disabled={!enabled || !can("facebook_messaging") || !config?.facebook_configured || busy !== null} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white disabled:opacity-40">{busy === "facebook" ? "Opening Meta…" : "Connect Facebook"}</button></article> : null}
      {!connectedTypes.has("whatsapp") ? <article className="card-base p-5"><MessageCircle className="text-emerald-600" /><h2 className="mt-3 font-black">WhatsApp Business</h2><p className="mt-1 text-sm text-[var(--color-txt-sec)]">Use Meta Embedded Signup to connect a WABA and verified phone number.</p><button onClick={() => void connectWhatsApp()} disabled={!enabled || !can("whatsapp_messaging") || !config?.whatsapp_configured || busy !== null} className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white disabled:opacity-40">Connect WhatsApp</button></article> : null}
      <article className="card-base p-5 opacity-70"><Camera /><h2 className="mt-3 font-black">Instagram</h2><p className="mt-1 text-sm text-[var(--color-txt-sec)]">Prepared for a future connector. Not available in Phase 14.</p></article>
    </section>
    {config && !config.configured ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{config.message}</p> : null}
    <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-950"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0" size={20} /><div><h2 className="font-black">Credential boundary</h2><p className="mt-1 text-sm leading-6">Meta tokens are encrypted at rest and decrypted only inside server-side adapters. Inbox agents never receive or need them.</p></div></div></section>
  </div>;
}
