import assert from "node:assert/strict";
import test from "node:test";

import { indexBuilderMenus, selectBuilderTheme } from "../lib/storefront-builder-bootstrap";
import type { OnlineStoreMenu, OnlineStoreTheme } from "../lib/online-store";

const published = { id: "published", status: "published", templates: [{ id: "home" }] } as OnlineStoreTheme;
const draft = { id: "draft", status: "draft", templates: [{ id: "draft-home" }] } as OnlineStoreTheme;

test("Builder Customize resolves the canonical draft theme without a query parameter", () => {
  assert.equal(selectBuilderTheme([published, draft])?.id, "draft");
  assert.equal(selectBuilderTheme([published, draft], "published")?.id, "published");
  assert.equal(selectBuilderTheme([published, draft], "missing"), null);
});

test("Builder Customize indexes tenant-scoped admin menus for the preview", () => {
  const menus = [{ id: "menu", name: "Main", location: "main_nav", is_active: true, items: [{ label: "Home", url: "/" }] }] as OnlineStoreMenu[];
  assert.deepEqual(indexBuilderMenus(menus), { main_nav: [{ label: "Home", url: "/" }] });
});
