import assert from "node:assert/strict";
import test from "node:test";

import { canAcceptBuilderChild, createBlockFromRegistry } from "../lib/storefront-block-registry";
import { cloneBlockWithNewIds, normalizeBuilderBlocks, type BuilderBlock } from "../lib/storefront-builder";
import { copyBuilderStyles, pasteBuilderStyles, resolveNodeStyleRules, resolveNodeStyles } from "../lib/storefront-builder-style";
import { findBuilderLocation, findTreeNode, isBuilderDescendant, moveTreeNode, sanitizeTreeRelationships, walkBuilderTree, wrapTreeNode } from "../lib/storefront-builder-tree";
import { resolveThemeTemplate, templateOwnerKey } from "../lib/storefront-template";
import type { OnlineStoreTemplate, OnlineStoreTheme } from "../lib/online-store";

function nestedFixture() {
  const container = createBlockFromRegistry("container");
  const stack = createBlockFromRegistry("stack");
  const heading = createBlockFromRegistry("heading");
  const paragraph = createBlockFromRegistry("paragraph");
  stack.children = [heading, paragraph];
  container.children = [stack];
  return { tree: [container], container, stack, heading, paragraph };
}

test("nested normalization repairs missing and duplicate IDs", () => {
  const tree = normalizeBuilderBlocks([
    { id: "duplicate", type: "container", children: [{ id: "duplicate", type: "heading", props: { text: "Nested" } }] },
    { type: "paragraph", children: "invalid" },
  ]);
  const ids: string[] = [];
  walkBuilderTree(tree, (node) => ids.push(node.id));
  assert.equal(ids.length, new Set(ids).size);
  assert.equal(tree[1].children.length, 0);
  assert.match(tree[1].id, /^[0-9a-f-]{36}$/i);
});

test("normalization tolerates circular editor objects", () => {
  const source: Record<string, unknown> = { type: "container" };
  source.children = [source];
  const tree = normalizeBuilderBlocks([source]);
  assert.equal(tree[0].children.length, 1);
  assert.equal(tree[0].children[0].children.length, 0);
});

test("recursive clone creates fresh IDs for every descendant", () => {
  const { container } = nestedFixture();
  const clone = cloneBlockWithNewIds(container);
  const originalIds: string[] = [];
  const clonedIds: string[] = [];
  walkBuilderTree([container], (node) => originalIds.push(node.id));
  walkBuilderTree([clone], (node) => clonedIds.push(node.id));
  assert.equal(clonedIds.length, originalIds.length);
  assert.equal(clonedIds.length, new Set(clonedIds).size);
  assert.equal(clonedIds.some((id) => originalIds.includes(id)), false);
});

test("tree move reparents a content block and preserves its ID", () => {
  const left = createBlockFromRegistry("stack");
  const right = createBlockFromRegistry("stack");
  const heading = createBlockFromRegistry("heading");
  left.children = [heading];
  const result = moveTreeNode([left, right], heading.id, { targetId: right.id, position: "inside" }, canAcceptBuilderChild);
  assert.equal(result.moved, true);
  assert.equal(findTreeNode(result.tree, heading.id)?.id, heading.id);
  assert.equal(findBuilderLocation(result.tree, heading.id)?.parentId, right.id);
});

test("tree move reorders siblings with before and after targets", () => {
  const first = createBlockFromRegistry("heading");
  const second = createBlockFromRegistry("paragraph");
  const third = createBlockFromRegistry("button");
  const result = moveTreeNode([first, second, third], third.id, { targetId: first.id, position: "before" }, canAcceptBuilderChild);
  assert.deepEqual(result.tree.map((node) => node.id), [third.id, first.id, second.id]);
});

test("parent into descendant and leaf-parent drops are rejected", () => {
  const { tree, container, heading } = nestedFixture();
  assert.equal(isBuilderDescendant(tree, container.id, heading.id), true);
  const descendantDrop = moveTreeNode(tree, container.id, { targetId: heading.id, position: "inside" }, canAcceptBuilderChild);
  assert.equal(descendantDrop.moved, false);
  assert.match(descendantDrop.reason || "", /descendant/i);
  const separateStack = createBlockFromRegistry("stack");
  const separateHeading = createBlockFromRegistry("heading");
  const leafDrop = moveTreeNode([separateStack, separateHeading], separateStack.id, { targetId: separateHeading.id, position: "inside" }, canAcceptBuilderChild);
  assert.equal(leafDrop.moved, false);
  assert.match(leafDrop.reason || "", /does not accept/i);
});

test("invalid leaf children are hoisted without data loss", () => {
  const heading = createBlockFromRegistry("heading");
  const paragraph = createBlockFromRegistry("paragraph");
  heading.children = [paragraph];
  const repaired = sanitizeTreeRelationships([heading], canAcceptBuilderChild);
  assert.deepEqual(repaired.map((node) => node.id), [heading.id, paragraph.id]);
  assert.equal(repaired[0].children.length, 0);
});

test("unknown nodes remain traversable and safely nested", () => {
  const unknown = normalizeBuilderBlocks([{ type: "future_app_block", children: [] }])[0] as BuilderBlock;
  const container = createBlockFromRegistry("container");
  const result = moveTreeNode([container, unknown], unknown.id, { targetId: container.id, position: "inside" }, canAcceptBuilderChild);
  assert.equal(result.moved, true);
  assert.equal(findBuilderLocation(result.tree, unknown.id)?.parentId, container.id);
});

test("template resolution accepts only compatible assignments and falls back to the default", () => {
  const productDefault = { id: "product-default", theme_id: "theme", name: "Default product", key: "product-default", resource_type: "product", is_default: true, settings: {}, sections: [], created_at: "", updated_at: "" } satisfies OnlineStoreTemplate;
  const editorial = { ...productDefault, id: "editorial", key: "editorial", name: "Editorial", is_default: false } satisfies OnlineStoreTemplate;
  const page = { ...productDefault, id: "page-default", key: "page-default", name: "Default page", resource_type: "page", is_default: true } satisfies OnlineStoreTemplate;
  const theme = { id: "theme", name: "Theme", key: "theme", status: "published", version: "1", settings: {}, created_at: "", updated_at: "", templates: [productDefault, editorial, page], section_groups: [] } satisfies OnlineStoreTheme;
  assert.equal(resolveThemeTemplate(theme, "product", editorial.id)?.id, editorial.id);
  assert.equal(resolveThemeTemplate(theme, "product", page.id)?.id, productDefault.id);
  assert.equal(resolveThemeTemplate(theme, "cart", null), null);
  assert.equal(templateOwnerKey(editorial), "theme:product:editorial");
});

test("style cascade applies classes in order then element, responsive, and hover overrides", () => {
  const node = createBlockFromRegistry("div");
  node.class_ids = ["base-card", "premium-card"];
  node.style.base = { color: "#444444", padding: { top: { value: 24, unit: "px" } } };
  node.style.hover = { opacity: 0.9 };
  node.responsive.mobile.styles = { base: { color: "#555555" }, hover: { opacity: 0.75 } };
  const theme: OnlineStoreTheme = {
    id: "theme", name: "Theme", key: "theme", status: "draft", version: "1", settings: {}, created_at: "", updated_at: "", templates: [], section_groups: [],
    style_classes: [
      { id: "base-card", theme_id: "theme", name: "card", styles: { color: "#111111", opacity: 0.6 }, responsive: {}, states: { hover: { opacity: 0.7 } }, created_at: "", updated_at: "" },
      { id: "premium-card", theme_id: "theme", name: "premium-card", styles: { color: "#222222" }, responsive: { mobile: { base: { color: "#333333" } } }, states: {}, created_at: "", updated_at: "" },
    ],
  };
  assert.equal(resolveNodeStyleRules(theme, node, "desktop").color, "#444444");
  assert.equal(resolveNodeStyleRules(theme, node, "mobile").color, "#555555");
  assert.equal(resolveNodeStyleRules(theme, node, "mobile", "hover").opacity, 0.75);
  assert.equal(resolveNodeStyles(theme, node, "desktop").paddingTop, "24px");
});

test("copy and paste styles leaves content, identity, children, and classes untouched", () => {
  const source = createBlockFromRegistry("div");
  source.style.base = { width: { value: 50, unit: "%" }, backgroundColor: "#ffffff" };
  source.responsive.mobile.styles = { hover: { opacity: 0.8 } };
  const target = createBlockFromRegistry("heading");
  target.class_ids = ["title"];
  const pasted = pasteBuilderStyles(target, copyBuilderStyles(source));
  assert.equal(pasted.id, target.id);
  assert.deepEqual(pasted.props, target.props);
  assert.deepEqual(pasted.class_ids, ["title"]);
  assert.deepEqual(pasted.style.base, source.style.base);
  assert.deepEqual(pasted.responsive.mobile.styles, source.responsive.mobile.styles);
});

test("wrap in Div preserves child identity and creates a fresh structural parent", () => {
  const heading = createBlockFromRegistry("heading");
  const wrapper = createBlockFromRegistry("div");
  const result = wrapTreeNode([heading], heading.id, wrapper);
  assert.equal(result.moved, true);
  assert.equal(result.tree[0].id, wrapper.id);
  assert.equal(result.tree[0].type, "div");
  assert.equal(result.tree[0].children[0].id, heading.id);
});
