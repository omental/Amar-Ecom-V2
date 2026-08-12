import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { Boxes, CircleDollarSign, Database, Grid2X2, Heading, ImageIcon, LayoutPanelTop, Link2, Minus, Package, Pilcrow, ShoppingBag, Space, Square, Tags } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { createBuilderNodeId, getBlockProps, type BuilderBlock, type BuilderBlockType, type BuilderDevice } from "@/lib/storefront-builder";
import type { getStorefrontTheme } from "@/lib/storefront-theme";
import { AddToCartBlock, CollectionDescriptionBlock, CollectionImageBlock, CollectionTitleBlock, ProductAvailabilityBlock, ProductBrandBlock, ProductDescriptionBlock, ProductMediaBlock, ProductPriceBlock, ProductSkuBlock, ProductTitleBlock, QuantitySelectorBlock, QueryLoopBlock, VariantSelectorBlock } from "@/components/storefront/blocks/DynamicCommerceBlocks";

export type BlockCategory = "layout" | "content" | "dynamic" | "product" | "collection" | "cart" | "commerce" | "apps";
export type BlockField = { key: string; label: string; type: "text" | "textarea" | "select" | "number" | "color" | "media"; options?: Array<{ label: string; value: string }>; min?: number; max?: number; responsive?: boolean };
export type BlockCapabilities = { canHaveChildren: boolean; acceptedCategories: BlockCategory[]; canMove: boolean; canDelete: boolean; canDuplicate: boolean };
export type BlockRenderContext = {
  node: BuilderBlock;
  props: Record<string, unknown>;
  responsiveProps: Record<BuilderDevice, Record<string, unknown>>;
  theme: ReturnType<typeof getStorefrontTheme>;
  children: ReactNode;
  renderChildren: (scopeKey?: string) => ReactNode;
};
export type BlockDefinition = {
  type: BuilderBlockType;
  label: string;
  description: string;
  category: BlockCategory;
  icon: LucideIcon;
  defaultProps: Record<string, unknown>;
  defaultStyle?: Record<string, unknown>;
  defaultResponsive?: Partial<Record<BuilderDevice, Record<string, unknown>>>;
  capabilities: BlockCapabilities;
  fields: BlockField[];
  render: (context: BlockRenderContext) => ReactNode;
};

const alignOptions = ["left", "center", "right"].map((value) => ({ label: value[0].toUpperCase() + value.slice(1), value }));
const gapOptions = ["none", "sm", "md", "lg", "xl"].map((value) => ({ label: value.toUpperCase(), value }));
const layoutCapabilities: BlockCapabilities = { canHaveChildren: true, acceptedCategories: ["layout", "content", "dynamic", "product", "collection", "cart", "commerce", "apps"], canMove: true, canDelete: true, canDuplicate: true };
const queryCapabilities: BlockCapabilities = { ...layoutCapabilities, acceptedCategories: ["layout", "content", "product", "commerce"] };
const leafCapabilities: BlockCapabilities = { canHaveChildren: false, acceptedCategories: [], canMove: true, canDelete: true, canDuplicate: true };

function safeUrl(value: unknown) {
  const url = String(value || "").trim();
  return url.startsWith("/") || url.startsWith("https://") || url.startsWith("http://") ? url : "";
}

function textAlign(value: unknown) {
  return value === "center" ? "text-center" : value === "right" ? "text-right" : "text-left";
}

function gapClass(value: unknown, breakpoint: "base" | "sm" | "lg" = "base") {
  const index = value === "none" ? 0 : value === "sm" ? 1 : value === "lg" ? 3 : value === "xl" ? 4 : 2;
  const classes = {
    base: ["gap-0", "gap-2", "gap-4", "gap-8", "gap-12"],
    sm: ["sm:gap-0", "sm:gap-2", "sm:gap-4", "sm:gap-8", "sm:gap-12"],
    lg: ["lg:gap-0", "lg:gap-2", "lg:gap-4", "lg:gap-8", "lg:gap-12"],
  } as const;
  return classes[breakpoint][index];
}

function paddingClass(value: unknown, breakpoint: "base" | "sm" | "lg") {
  const index = value === "none" ? 0 : value === "sm" ? 1 : value === "lg" ? 3 : value === "xl" ? 4 : 2;
  const classes = {
    base: ["p-0", "p-3", "p-5", "p-8", "p-12"],
    sm: ["sm:p-0", "sm:p-3", "sm:p-5", "sm:p-8", "sm:p-12"],
    lg: ["lg:p-0", "lg:p-3", "lg:p-5", "lg:p-8", "lg:p-12"],
  } as const;
  return classes[breakpoint][index];
}

function gridColumns(value: unknown, breakpoint: "base" | "sm" | "lg") {
  const count = Math.max(1, Math.min(6, Number(value) || 1));
  const classes = {
    base: ["grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4", "grid-cols-5", "grid-cols-6"],
    sm: ["sm:grid-cols-1", "sm:grid-cols-2", "sm:grid-cols-3", "sm:grid-cols-4", "sm:grid-cols-5", "sm:grid-cols-6"],
    lg: ["lg:grid-cols-1", "lg:grid-cols-2", "lg:grid-cols-3", "lg:grid-cols-4", "lg:grid-cols-5", "lg:grid-cols-6"],
  } as const;
  return classes[breakpoint][count - 1];
}

function directionClass(value: unknown, breakpoint: "base" | "sm" | "lg") {
  if (breakpoint === "sm") return value === "horizontal" ? "sm:flex-row" : "sm:flex-col";
  if (breakpoint === "lg") return value === "horizontal" ? "lg:flex-row" : "lg:flex-col";
  return value === "horizontal" ? "flex-row" : "flex-col";
}

function alignmentClass(value: unknown) {
  if (value === "center") return "items-center";
  if (value === "end") return "items-end";
  if (value === "stretch") return "items-stretch";
  return "items-start";
}

function justifyClass(value: unknown) {
  if (value === "center") return "justify-center";
  if (value === "end") return "justify-end";
  if (value === "between") return "justify-between";
  return "justify-start";
}

export function resolveBuilderBlockProps(block: BuilderBlock, device: BuilderDevice) {
  const base = getBlockProps(block);
  if (device === "desktop") return base;
  if (device === "tablet") return { ...base, ...block.responsive.tablet };
  return { ...base, ...block.responsive.tablet, ...block.responsive.mobile };
}

function responsiveValues(block: BuilderBlock) {
  return {
    desktop: resolveBuilderBlockProps(block, "desktop"),
    tablet: resolveBuilderBlockProps(block, "tablet"),
    mobile: resolveBuilderBlockProps(block, "mobile"),
  };
}

export const blockRegistry: Record<BuilderBlockType, BlockDefinition> = {
  div: {
    type: "div", label: "Div", description: "Generic structural element with unrestricted nested layout.", category: "layout", icon: Square,
    defaultProps: {}, defaultStyle: { display: "block" }, capabilities: layoutCapabilities, fields: [],
    render: ({ children }) => <>{children}</>,
  },
  container: {
    type: "container", label: "Container", description: "Responsive content boundary.", category: "layout", icon: LayoutPanelTop,
    defaultProps: { max_width: "default", align: "center", padding: "md", gap: "md", background_preset: "transparent", background_color: "" }, capabilities: layoutCapabilities,
    defaultResponsive: { mobile: { padding: "sm", gap: "sm" } },
    fields: [
      { key: "max_width", label: "Max width", type: "select", options: ["narrow", "default", "wide", "full"].map((value) => ({ label: value, value })) },
      { key: "align", label: "Horizontal alignment", type: "select", options: alignOptions },
      { key: "padding", label: "Padding", type: "select", options: gapOptions, responsive: true },
      { key: "gap", label: "Gap", type: "select", options: gapOptions, responsive: true },
      { key: "background_preset", label: "Background", type: "select", options: ["transparent", "white", "soft", "dark", "custom"].map((value) => ({ label: value, value })) },
      { key: "background_color", label: "Custom color", type: "color" },
    ],
    render: ({ props, responsiveProps, children }) => {
      const widths: Record<string, string> = { narrow: "max-w-[760px]", default: "max-w-[1040px]", wide: "max-w-[1200px]", full: "max-w-none" };
      const background = props.background_preset === "white" ? "bg-white" : props.background_preset === "soft" ? "bg-[var(--store-accent-soft)]" : props.background_preset === "dark" ? "bg-[#111] text-white" : "bg-transparent";
      const customStyle: CSSProperties | undefined = props.background_preset === "custom" && props.background_color ? { backgroundColor: String(props.background_color) } : undefined;
      const margin = props.align === "right" ? "ml-auto" : props.align === "left" ? "mr-auto" : "mx-auto";
      return <div className={`flex w-full flex-col ${widths[String(props.max_width)] || widths.default} ${margin} ${paddingClass(responsiveProps.mobile.padding, "base")} ${paddingClass(responsiveProps.tablet.padding, "sm")} ${paddingClass(responsiveProps.desktop.padding, "lg")} ${background} ${gapClass(responsiveProps.mobile.gap, "base")} ${gapClass(responsiveProps.tablet.gap, "sm")} ${gapClass(responsiveProps.desktop.gap, "lg")}`} style={customStyle}>{children}</div>;
    },
  },
  stack: {
    type: "stack", label: "Stack", description: "Responsive flex layout.", category: "layout", icon: Boxes,
    defaultProps: { direction: "vertical", gap: "md", align: "stretch", justify: "start", wrap: false }, capabilities: layoutCapabilities,
    fields: [
      { key: "direction", label: "Direction", type: "select", options: ["vertical", "horizontal"].map((value) => ({ label: value, value })), responsive: true },
      { key: "gap", label: "Gap", type: "select", options: gapOptions, responsive: true },
      { key: "align", label: "Alignment", type: "select", options: ["start", "center", "end", "stretch"].map((value) => ({ label: value, value })) },
      { key: "justify", label: "Justify", type: "select", options: ["start", "center", "end", "between"].map((value) => ({ label: value, value })) },
      { key: "wrap", label: "Wrap", type: "select", options: [{ label: "No wrap", value: "false" }, { label: "Wrap", value: "true" }] },
    ],
    render: ({ props, responsiveProps, children }) => <div className={`flex w-full ${directionClass(responsiveProps.mobile.direction, "base")} ${directionClass(responsiveProps.tablet.direction, "sm")} ${directionClass(responsiveProps.desktop.direction, "lg")} ${gapClass(responsiveProps.mobile.gap, "base")} ${gapClass(responsiveProps.tablet.gap, "sm")} ${gapClass(responsiveProps.desktop.gap, "lg")} ${alignmentClass(props.align)} ${justifyClass(props.justify)} ${String(props.wrap) === "true" || props.wrap === true ? "flex-wrap" : "flex-nowrap"}`}>{children}</div>,
  },
  grid: {
    type: "grid", label: "Grid", description: "Responsive CSS grid layout.", category: "layout", icon: Grid2X2,
    defaultProps: { columns: 3, gap: "md", align: "stretch" }, capabilities: layoutCapabilities,
    defaultResponsive: { tablet: { columns: 2 }, mobile: { columns: 1, gap: "sm" } },
    fields: [
      { key: "columns", label: "Columns", type: "number", min: 1, max: 6, responsive: true },
      { key: "gap", label: "Gap", type: "select", options: gapOptions, responsive: true },
      { key: "align", label: "Alignment", type: "select", options: ["start", "center", "end", "stretch"].map((value) => ({ label: value, value })) },
    ],
    render: ({ props, responsiveProps, children }) => <div className={`grid w-full ${gridColumns(responsiveProps.mobile.columns, "base")} ${gridColumns(responsiveProps.tablet.columns, "sm")} ${gridColumns(responsiveProps.desktop.columns, "lg")} ${gapClass(responsiveProps.mobile.gap, "base")} ${gapClass(responsiveProps.tablet.gap, "sm")} ${gapClass(responsiveProps.desktop.gap, "lg")} ${alignmentClass(props.align)}`}>{children}</div>,
  },
  heading: {
    type: "heading", label: "Heading", description: "Semantic section heading.", category: "content", icon: Heading,
    defaultProps: { text: "Tell your story", level: "h2", align: "left" }, capabilities: leafCapabilities,
    fields: [{ key: "text", label: "Text", type: "text" }, { key: "level", label: "Heading level", type: "select", options: ["h1", "h2", "h3"].map((value) => ({ label: value.toUpperCase(), value })) }, { key: "align", label: "Alignment", type: "select", options: alignOptions, responsive: true }],
    render: ({ props }) => { const Tag = (["h1", "h2", "h3"].includes(String(props.level)) ? props.level : "h2") as "h1" | "h2" | "h3"; return <Tag className={`${textAlign(props.align)} font-black tracking-tight text-black ${Tag === "h1" ? "text-3xl sm:text-4xl" : Tag === "h3" ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"}`}>{String(props.text || "")}</Tag>; },
  },
  paragraph: {
    type: "paragraph", label: "Paragraph", description: "Supporting paragraph copy.", category: "content", icon: Pilcrow,
    defaultProps: { text: "Add supporting copy for this section.", align: "left" }, capabilities: leafCapabilities,
    fields: [{ key: "text", label: "Text", type: "textarea" }, { key: "align", label: "Alignment", type: "select", options: alignOptions, responsive: true }],
    render: ({ props }) => <p className={`${textAlign(props.align)} text-sm leading-7 text-[#4b5563]`}>{String(props.text || "")}</p>,
  },
  image: {
    type: "image", label: "Image", description: "Responsive media with optional link.", category: "content", icon: ImageIcon,
    defaultProps: { image_url: "", alt: "", link_url: "", radius_preset: "soft" }, capabilities: leafCapabilities,
    fields: [{ key: "image_url", label: "Image", type: "media" }, { key: "alt", label: "Alt text", type: "text" }, { key: "link_url", label: "Link", type: "text" }, { key: "radius_preset", label: "Radius", type: "select", options: ["sharp", "soft", "rounded"].map((value) => ({ label: value, value })) }],
    render: ({ props }) => { const src = safeUrl(props.image_url); if (!src) return null; const image = <img /* eslint-disable-line @next/next/no-img-element */ src={src} alt={String(props.alt || "Storefront content image")} className={`h-auto w-full object-cover ${props.radius_preset === "rounded" ? "rounded-[28px]" : props.radius_preset === "sharp" ? "rounded-none" : "rounded-[20px]"}`} />; const href = safeUrl(props.link_url); return href ? <Link href={href}>{image}</Link> : image; },
  },
  button: {
    type: "button", label: "Button", description: "Storefront call to action.", category: "content", icon: Link2,
    defaultProps: { label: "Shop now", href: "/products", style: "primary", align: "left" }, defaultStyle: { display: "inline-flex", backgroundColor: "var(--store-accent)", color: "#ffffff", padding: { top: { value: 12, unit: "px" }, right: { value: 20, unit: "px" }, bottom: { value: 12, unit: "px" }, left: { value: 20, unit: "px" }, linked: false }, borderRadius: { value: 14, unit: "px" } }, capabilities: leafCapabilities,
    fields: [{ key: "label", label: "Label", type: "text" }, { key: "href", label: "URL", type: "text" }, { key: "style", label: "Style", type: "select", options: ["primary", "secondary"].map((value) => ({ label: value, value })) }, { key: "align", label: "Alignment", type: "select", options: alignOptions, responsive: true }],
    render: ({ props, theme }) => { const href = safeUrl(props.href); if (!href) return null; const justify = props.align === "center" ? "justify-center" : props.align === "right" ? "justify-end" : "justify-start"; return <div className={`flex ${justify}`}><Link href={href} className={`inline-flex px-5 py-3 text-sm font-semibold ${theme.buttonRadiusClass} ${props.style === "secondary" ? "border border-[#d1d5db] bg-white text-black" : "text-white"}`} style={props.style === "secondary" ? undefined : { backgroundColor: theme.primaryColor }}>{String(props.label || "Learn more")}</Link></div>; },
  },
  query_loop: { type: "query_loop", label: "Query Loop", description: "Repeat child elements for a bounded product query.", category: "dynamic", icon: Database, defaultProps: { limit: 8, category: "" }, capabilities: queryCapabilities, fields: [{ key: "limit", label: "Limit", type: "number", min: 1, max: 24 }, { key: "category", label: "Category slug (or current)", type: "text" }], render: ({ props, renderChildren }) => <QueryLoopBlock limit={Math.min(24, Math.max(1, Number(props.limit) || 8))} category={String(props.category || "") || undefined} renderItem={renderChildren} /> },
  product_title: { type: "product_title", label: "Product Title", description: "Title from the current product or query item.", category: "product", icon: Heading, defaultProps: {}, capabilities: leafCapabilities, fields: [], render: () => <ProductTitleBlock /> },
  product_media: { type: "product_media", label: "Product Media", description: "Current product media.", category: "product", icon: ImageIcon, defaultProps: {}, capabilities: leafCapabilities, fields: [], render: () => <ProductMediaBlock /> },
  product_price: { type: "product_price", label: "Product Price", description: "Selected variant or product price.", category: "product", icon: CircleDollarSign, defaultProps: {}, capabilities: leafCapabilities, fields: [], render: () => <ProductPriceBlock /> },
  product_compare_price: { type: "product_compare_price", label: "Compare-at Price", description: "Original product price.", category: "product", icon: CircleDollarSign, defaultProps: {}, capabilities: leafCapabilities, fields: [], render: () => <ProductPriceBlock compare /> },
  product_description: { type: "product_description", label: "Product Description", description: "Current product description.", category: "product", icon: Pilcrow, defaultProps: {}, capabilities: leafCapabilities, fields: [], render: () => <ProductDescriptionBlock /> },
  product_sku: { type: "product_sku", label: "Product SKU", description: "Current variant or product SKU.", category: "product", icon: Tags, defaultProps: {}, capabilities: leafCapabilities, fields: [], render: () => <ProductSkuBlock /> },
  product_brand: { type: "product_brand", label: "Product Brand", description: "Current product brand.", category: "product", icon: Tags, defaultProps: {}, capabilities: leafCapabilities, fields: [], render: () => <ProductBrandBlock /> },
  product_availability: { type: "product_availability", label: "Availability", description: "Live product availability.", category: "product", icon: Package, defaultProps: {}, capabilities: leafCapabilities, fields: [], render: () => <ProductAvailabilityBlock /> },
  variant_selector: { type: "variant_selector", label: "Variant Selector", description: "Select a live product variant.", category: "product", icon: Tags, defaultProps: {}, capabilities: leafCapabilities, fields: [], render: () => <VariantSelectorBlock /> },
  quantity_selector: { type: "quantity_selector", label: "Quantity", description: "Cart quantity control.", category: "product", icon: Package, defaultProps: {}, capabilities: leafCapabilities, fields: [], render: () => <QuantitySelectorBlock /> },
  add_to_cart: { type: "add_to_cart", label: "Add to Cart", description: "Add selected variant and quantity to the existing cart.", category: "product", icon: ShoppingBag, defaultProps: { label: "Add to cart" }, capabilities: leafCapabilities, fields: [{ key: "label", label: "Label", type: "text" }], render: ({ props }) => <AddToCartBlock label={String(props.label || "Add to cart")} /> },
  collection_title: { type: "collection_title", label: "Collection Title", description: "Current collection title.", category: "collection", icon: Heading, defaultProps: {}, capabilities: leafCapabilities, fields: [], render: () => <CollectionTitleBlock /> },
  collection_description: { type: "collection_description", label: "Collection Description", description: "Current collection description.", category: "collection", icon: Pilcrow, defaultProps: {}, capabilities: leafCapabilities, fields: [], render: () => <CollectionDescriptionBlock /> },
  collection_image: { type: "collection_image", label: "Collection Image", description: "Current collection image.", category: "collection", icon: ImageIcon, defaultProps: {}, capabilities: leafCapabilities, fields: [], render: () => <CollectionImageBlock /> },
  spacer: { type: "spacer", label: "Spacer", description: "Controlled vertical space.", category: "content", icon: Space, defaultProps: { size: "md" }, capabilities: leafCapabilities, fields: [{ key: "size", label: "Size", type: "select", options: ["sm", "md", "lg"].map((value) => ({ label: value.toUpperCase(), value })) }], render: ({ props }) => <div className={props.size === "lg" ? "h-12" : props.size === "sm" ? "h-4" : "h-8"} aria-hidden="true" /> },
  divider: { type: "divider", label: "Divider", description: "Visual separator.", category: "content", icon: Minus, defaultProps: { style: "subtle" }, capabilities: leafCapabilities, fields: [{ key: "style", label: "Style", type: "select", options: ["subtle", "solid", "dashed"].map((value) => ({ label: value, value })) }], render: ({ props }) => <hr className={`border-[#d1d5db] ${props.style === "dashed" ? "border-dashed" : "border-solid"} ${props.style === "subtle" ? "opacity-60" : ""}`} /> },
};

export const blockDefinitions = Object.values(blockRegistry);

export function createBlockFromRegistry(type: BuilderBlockType, column = 1): BuilderBlock {
  const definition = blockRegistry[type];
  return { id: createBuilderNodeId(), type, column, props: structuredClone(definition.defaultProps), style: { base: structuredClone(definition.defaultStyle || {}), hover: {}, focus: {}, active: {} }, responsive: { desktop: structuredClone(definition.defaultResponsive?.desktop || {}), tablet: structuredClone(definition.defaultResponsive?.tablet || {}), mobile: structuredClone(definition.defaultResponsive?.mobile || {}) }, class_ids: [], meta: {}, children: [] };
}

export function getBlockDefinition(type: string) {
  return blockRegistry[type as BuilderBlockType];
}

export function canAcceptBuilderChild(parent: BuilderBlock | null, child: BuilderBlock) {
  if (!parent) return true;
  const parentDefinition = getBlockDefinition(parent.type);
  const childDefinition = getBlockDefinition(child.type);
  if (!parentDefinition?.capabilities.canHaveChildren) return false;
  if (!childDefinition) return true;
  return parentDefinition.capabilities.acceptedCategories.includes(childDefinition.category);
}

export function getResponsiveRenderProps(block: BuilderBlock) {
  return responsiveValues(block);
}
