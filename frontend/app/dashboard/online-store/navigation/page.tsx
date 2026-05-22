"use client";

import { FormEvent, useEffect, useState } from "react";

import { OnlineStoreTabs } from "@/components/dashboard/online-store/OnlineStoreTabs";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { api, ApiError } from "@/lib/api";
import type { OnlineStoreMenu, OnlineStoreMenuItem } from "@/lib/online-store";

const initialItem = { label: "", url: "", target: "_self", is_active: true };

export default function OnlineStoreNavigationPage() {
  const [menus, setMenus] = useState<OnlineStoreMenu[]>([]);
  const [draftItems, setDraftItems] = useState<Record<string, typeof initialItem>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadMenus() {
    const payload = await api.get<OnlineStoreMenu[]>("/admin/storefront/menus");
    setMenus(payload);
    setDraftItems(
      Object.fromEntries(payload.map((menu) => [menu.id, { ...initialItem }]))
    );
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        if (!mounted) return;
        await loadMenus();
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load storefront menus.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  async function createItem(menuId: string, event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      await api.post<OnlineStoreMenuItem>(`/admin/storefront/menus/${menuId}/items`, draftItems[menuId]);
      await loadMenus();
      setSuccess("Menu item added.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add menu item.");
    }
  }

  async function updateItem(itemId: string, payload: Partial<OnlineStoreMenuItem>) {
    setError("");
    setSuccess("");
    try {
      await api.put(`/admin/storefront/menu-items/${itemId}`, payload);
      await loadMenus();
      setSuccess("Menu item updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update menu item.");
    }
  }

  async function moveItem(menu: OnlineStoreMenu, itemId: string, direction: "up" | "down") {
    const ids = menu.items.map((item) => item.id!).filter(Boolean);
    const index = ids.indexOf(itemId);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || swapIndex < 0 || swapIndex >= ids.length) return;
    [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
    try {
      await api.post(`/admin/storefront/menus/${menu.id}/items/reorder`, { ordered_ids: ids });
      await loadMenus();
      setSuccess("Menu order updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reorder menu items.");
    }
  }

  async function deleteItem(itemId: string) {
    try {
      await api.delete(`/admin/storefront/menu-items/${itemId}`);
      await loadMenus();
      setSuccess("Menu item disabled.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to disable menu item.");
    }
  }

  return (
    <div className="space-y-6">
      <OpsPageHeader
        eyebrow="Online Store"
        title="Navigation Manager"
        description="Manage storefront menus by location with safe, predefined navigation containers."
      />
      <OnlineStoreTabs />

      {loading ? <LoadingState label="Loading storefront navigation..." /> : null}
      {!loading && error ? <ErrorAlert message={error} /> : null}
      {success ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
          {success}
        </div>
      ) : null}

      {!loading
        ? menus.map((menu) => (
            <FormCard
              key={menu.id}
              title={`${menu.name} (${menu.location})`}
              description="Add items, toggle visibility, and change order with simple up/down controls."
            >
              <div className="space-y-4">
                <div className="space-y-3">
                  {menu.items.map((item, index) => (
                    <div key={item.id} className="rounded-[18px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] p-4">
                      <div className="grid gap-3 md:grid-cols-[1.2fr_1.2fr_120px_auto]">
                        <input
                          value={item.label}
                          onChange={(e) =>
                            setMenus((current) =>
                              current.map((currentMenu) =>
                                currentMenu.id !== menu.id
                                  ? currentMenu
                                  : {
                                      ...currentMenu,
                                      items: currentMenu.items.map((currentItem) =>
                                        currentItem.id === item.id ? { ...currentItem, label: e.target.value } : currentItem,
                                      ),
                                    },
                              ),
                            )
                          }
                          className="rounded-2xl border border-[var(--color-brd)] bg-white px-4 py-3 text-sm outline-none"
                        />
                        <input
                          value={item.url}
                          onChange={(e) =>
                            setMenus((current) =>
                              current.map((currentMenu) =>
                                currentMenu.id !== menu.id
                                  ? currentMenu
                                  : {
                                      ...currentMenu,
                                      items: currentMenu.items.map((currentItem) =>
                                        currentItem.id === item.id ? { ...currentItem, url: e.target.value } : currentItem,
                                      ),
                                    },
                              ),
                            )
                          }
                          className="rounded-2xl border border-[var(--color-brd)] bg-white px-4 py-3 text-sm outline-none"
                        />
                        <label className="flex items-center gap-2 rounded-2xl border border-[var(--color-brd)] bg-white px-4 py-3 text-sm">
                          <input
                            type="checkbox"
                            checked={item.is_active ?? true}
                            onChange={(e) => void updateItem(item.id!, { is_active: e.target.checked })}
                          />
                          Active
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => void updateItem(item.id!, { label: item.label, url: item.url })} className="rounded-full border border-[var(--color-brd)] px-3 py-2 text-xs font-semibold">
                            Save
                          </button>
                          <button type="button" disabled={index === 0} onClick={() => void moveItem(menu, item.id!, "up")} className="rounded-full border border-[var(--color-brd)] px-3 py-2 text-xs font-semibold disabled:opacity-50">
                            Up
                          </button>
                          <button type="button" disabled={index === menu.items.length - 1} onClick={() => void moveItem(menu, item.id!, "down")} className="rounded-full border border-[var(--color-brd)] px-3 py-2 text-xs font-semibold disabled:opacity-50">
                            Down
                          </button>
                          <button type="button" onClick={() => void deleteItem(item.id!)} className="rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600">
                            Disable
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <form onSubmit={(event) => void createItem(menu.id, event)} className="grid gap-3 rounded-[18px] border border-dashed border-[var(--color-brd)] p-4 md:grid-cols-[1fr_1fr_auto]">
                  <input
                    value={draftItems[menu.id]?.label || ""}
                    onChange={(e) => setDraftItems((current) => ({ ...current, [menu.id]: { ...current[menu.id], label: e.target.value } }))}
                    placeholder="Label"
                    className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none"
                  />
                  <input
                    value={draftItems[menu.id]?.url || ""}
                    onChange={(e) => setDraftItems((current) => ({ ...current, [menu.id]: { ...current[menu.id], url: e.target.value } }))}
                    placeholder="URL"
                    className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none"
                  />
                  <button type="submit" className="rounded-full bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white">
                    Add item
                  </button>
                </form>
              </div>
            </FormCard>
          ))
        : null}
    </div>
  );
}
