import type { OnlineStoreMenu, OnlineStoreMenuItem, OnlineStoreTheme } from "@/lib/online-store";

export function selectBuilderTheme(themes: OnlineStoreTheme[], requestedThemeId?: string | null) {
  if (requestedThemeId) return themes.find((theme) => theme.id === requestedThemeId) ?? null;
  return themes.find((theme) => theme.status === "draft")
    ?? themes.find((theme) => theme.status === "published")
    ?? themes[0]
    ?? null;
}

export function indexBuilderMenus(menus: OnlineStoreMenu[]): Record<string, OnlineStoreMenuItem[]> {
  return Object.fromEntries(menus.map((menu) => [menu.location, menu.items]));
}
