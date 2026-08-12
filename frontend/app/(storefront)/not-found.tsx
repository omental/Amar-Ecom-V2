import { StorefrontTemplateRenderer } from "@/components/storefront/StorefrontTemplateRenderer";
import { FALLBACK_STOREFRONT_SETTINGS } from "@/lib/online-store";
import { fetchPublicResolvedTemplateServer, fetchPublicStorefrontSettingsServer } from "@/lib/storefront-public-server";

export const dynamic = "force-dynamic";

export default async function StorefrontNotFound() {
  let resolved: Awaited<ReturnType<typeof fetchPublicResolvedTemplateServer>> | null = null;
  let settings = FALLBACK_STOREFRONT_SETTINGS;
  try {
    [resolved, settings] = await Promise.all([fetchPublicResolvedTemplateServer("not_found"), fetchPublicStorefrontSettingsServer().catch(() => FALLBACK_STOREFRONT_SETTINGS)]);
  } catch {}
  if (resolved) return <StorefrontTemplateRenderer sections={resolved.template.sections} settings={settings} context={{ resourceType: "not_found", resource: null, theme: resolved.theme, template: resolved.template, builderMode: false }} />;
  return <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-16 text-center"><h1 className="text-4xl font-black">Page not found</h1><p className="mt-4 text-slate-600">The page you requested does not exist.</p></section>;
}
