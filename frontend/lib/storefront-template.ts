import type { OnlineStoreTemplate, OnlineStoreTheme, StorefrontResourceType } from "@/lib/online-store";

export function templatesForResource(theme: OnlineStoreTheme, resourceType: StorefrontResourceType) {
  return theme.templates.filter((template) => template.resource_type === resourceType);
}

export function resolveThemeTemplate(theme: OnlineStoreTheme, resourceType: StorefrontResourceType, assignedTemplateId?: string | null): OnlineStoreTemplate | null {
  const compatible = templatesForResource(theme, resourceType);
  if (assignedTemplateId) {
    const assigned = compatible.find((template) => template.id === assignedTemplateId);
    if (assigned) return assigned;
  }
  return compatible.find((template) => template.is_default) || null;
}

export function templateOwnerKey(template: OnlineStoreTemplate) {
  return `${template.theme_id}:${template.resource_type}:${template.id}`;
}
