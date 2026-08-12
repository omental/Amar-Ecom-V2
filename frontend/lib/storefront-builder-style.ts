import type { CSSProperties } from "react";

import type { BuilderBlock, BuilderDevice } from "@/lib/storefront-builder";
import type { OnlineStoreStyleClass, OnlineStoreTheme } from "@/lib/online-store";

export const BUILDER_STYLE_STATES = ["base", "hover", "focus", "active"] as const;
export type BuilderStyleState = (typeof BUILDER_STYLE_STATES)[number];
export const CSS_UNITS = ["px", "%", "rem", "em", "vw", "vh"] as const;
export type CssNumericUnit = (typeof CSS_UNITS)[number];
export type CssKeywordValue = "auto" | "min-content" | "max-content" | "fit-content";
export type CssUnitValue = { value: number; unit: CssNumericUnit } | { value: CssKeywordValue };
export type BuilderBoxValues = { top?: CssUnitValue; right?: CssUnitValue; bottom?: CssUnitValue; left?: CssUnitValue; linked?: boolean };
export type BuilderShadowValue = { x?: number; y?: number; blur?: number; spread?: number; color?: string; inset?: boolean };
export type BuilderTransformValue = { translateX?: CssUnitValue; translateY?: CssUnitValue; rotate?: number; scaleX?: number; scaleY?: number; skewX?: number; skewY?: number; origin?: string };
export type BuilderGradientValue = { type: "linear" | "radial"; angle?: number; from?: string; to?: string };
export type BuilderBackgroundImageValue = { url?: string; position?: string; size?: string; repeat?: string; attachment?: string };
export type BuilderBackgroundOverlayValue = { color?: string; opacity?: number };
export type BuilderTransitionValue = { duration?: number; easing?: string; delay?: number };
export type BuilderStyleRules = Record<string, unknown>;
export type BuilderStyleSet = Record<BuilderStyleState, BuilderStyleRules>;
export type BuilderResponsiveStyleSet = Partial<Record<BuilderDevice, Partial<Record<BuilderStyleState, BuilderStyleRules>>>>;

export const EMPTY_STYLE_SET: BuilderStyleSet = { base: {}, hover: {}, focus: {}, active: {} };

const allowedCssProperties = new Set<keyof CSSProperties>([
  "display", "width", "minWidth", "maxWidth", "height", "minHeight", "maxHeight", "aspectRatio",
  "flexDirection", "flexWrap", "justifyContent", "alignItems", "alignContent", "gap", "rowGap", "columnGap",
  "flexGrow", "flexShrink", "flexBasis", "gridTemplateColumns", "gridAutoRows", "gridAutoFlow", "placeItems",
  "position", "top", "right", "bottom", "left", "zIndex", "overflow", "overflowX", "overflowY",
  "fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "letterSpacing", "textTransform",
  "textDecoration", "textAlign", "color", "whiteSpace", "backgroundColor", "backgroundImage", "backgroundPosition",
  "backgroundSize", "backgroundRepeat", "backgroundAttachment", "borderStyle", "borderColor", "borderWidth",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "borderRadius", "borderTopLeftRadius",
  "borderTopRightRadius", "borderBottomRightRadius", "borderBottomLeftRadius", "boxShadow", "opacity", "visibility",
  "transform", "transformOrigin", "transition", "filter", "backdropFilter", "objectFit", "objectPosition",
  "marginTop", "marginRight", "marginBottom", "marginLeft", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
]);

const keywordValues = new Set<CssKeywordValue>(["auto", "min-content", "max-content", "fit-content"]);
const colorPattern = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|transparent|currentColor|var\(--[a-z0-9-_]+\))$/i;

export function normalizeCssUnitValue(value: unknown): CssUnitValue | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  if (typeof source.value === "string" && keywordValues.has(source.value as CssKeywordValue)) return { value: source.value as CssKeywordValue };
  const numeric = Number(source.value);
  const unit = CSS_UNITS.includes(source.unit as CssNumericUnit) ? source.unit as CssNumericUnit : "px";
  return Number.isFinite(numeric) ? { value: Math.max(-100000, Math.min(100000, numeric)), unit } : undefined;
}

export function cssUnitToString(value: unknown): string | undefined {
  const normalized = normalizeCssUnitValue(value);
  return normalized ? typeof normalized.value === "number" ? `${normalized.value}${normalized.unit}` : normalized.value : undefined;
}

export function normalizeStyleSet(value: unknown): BuilderStyleSet {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const looksCanonical = BUILDER_STYLE_STATES.some((state) => source[state] && typeof source[state] === "object");
  const state = (key: BuilderStyleState) => source[key] && typeof source[key] === "object" && !Array.isArray(source[key]) ? { ...(source[key] as BuilderStyleRules) } : {};
  return looksCanonical ? { base: state("base"), hover: state("hover"), focus: state("focus"), active: state("active") } : { ...EMPTY_STYLE_SET, base: { ...source } };
}

function validColor(value: unknown, fallback = "transparent") { return typeof value === "string" && colorPattern.test(value.trim()) ? value.trim() : fallback; }
function finite(value: unknown, fallback = 0) { const numeric = Number(value); return Number.isFinite(numeric) ? numeric : fallback; }

function resolveSpecialRules(rules: BuilderStyleRules): BuilderStyleRules {
  const resolved = { ...rules };
  for (const generated of ["backgroundImage", "boxShadow", "transform", "transition", "filter"]) delete resolved[generated];
  const margin = rules.margin as BuilderBoxValues | undefined;
  const padding = rules.padding as BuilderBoxValues | undefined;
  for (const [prefix, box] of [["margin", margin], ["padding", padding]] as const) if (box && typeof box === "object") {
    for (const side of ["Top", "Right", "Bottom", "Left"] as const) resolved[`${prefix}${side}`] = cssUnitToString(box[side.toLowerCase() as "top" | "right" | "bottom" | "left"]);
  }
  const gradient = rules.backgroundGradient as BuilderGradientValue | undefined;
  if (gradient?.type === "linear") resolved.backgroundImage = `linear-gradient(${finite(gradient.angle, 135)}deg, ${validColor(gradient.from)}, ${validColor(gradient.to)})`;
  if (gradient?.type === "radial") resolved.backgroundImage = `radial-gradient(circle, ${validColor(gradient.from)}, ${validColor(gradient.to)})`;
  const backgroundImage = rules.backgroundImageValue as BuilderBackgroundImageValue | undefined;
  if (backgroundImage?.url && /^(\/|https?:\/\/)/.test(backgroundImage.url)) {
    resolved.backgroundImage = `url("${backgroundImage.url.replace(/["\\\n\r]/g, "")}")`;
    resolved.backgroundPosition = backgroundImage.position || "center"; resolved.backgroundSize = backgroundImage.size || "cover"; resolved.backgroundRepeat = backgroundImage.repeat || "no-repeat"; resolved.backgroundAttachment = backgroundImage.attachment || "scroll";
  }
  const overlay = rules.backgroundOverlay as BuilderBackgroundOverlayValue | undefined;
  if (overlay?.color) {
    const opacity = Math.max(0, Math.min(1, finite(overlay.opacity, 0.4)));
    const color = validColor(overlay.color, "#000000");
    const layer = `linear-gradient(color-mix(in srgb, ${color} ${opacity * 100}%, transparent), color-mix(in srgb, ${color} ${opacity * 100}%, transparent))`;
    resolved.backgroundImage = resolved.backgroundImage ? `${layer}, ${resolved.backgroundImage}` : layer;
  }
  const shadow = rules.shadow as BuilderShadowValue | undefined;
  if (shadow && typeof shadow === "object") resolved.boxShadow = `${shadow.inset ? "inset " : ""}${finite(shadow.x)}px ${finite(shadow.y, 8)}px ${Math.max(0, finite(shadow.blur, 24))}px ${finite(shadow.spread)}px ${validColor(shadow.color, "rgba(15,23,42,.16)")}`;
  const transform = rules.transformValue as BuilderTransformValue | undefined;
  if (transform && typeof transform === "object") {
    const parts = [`translate(${cssUnitToString(transform.translateX) || "0px"}, ${cssUnitToString(transform.translateY) || "0px"})`, `rotate(${finite(transform.rotate)}deg)`, `scale(${finite(transform.scaleX, 1)}, ${finite(transform.scaleY, transform.scaleX === undefined ? 1 : finite(transform.scaleX, 1))})`, `skew(${finite(transform.skewX)}deg, ${finite(transform.skewY)}deg)`];
    resolved.transform = parts.join(" "); resolved.transformOrigin = transform.origin || "center";
  }
  const transition = rules.transitionValue as BuilderTransitionValue | undefined;
  if (transition && typeof transition === "object") resolved.transition = `all ${Math.max(0, finite(transition.duration, 200))}ms ${["linear", "ease", "ease-in", "ease-out", "ease-in-out"].includes(String(transition.easing)) ? transition.easing : "ease"} ${Math.max(0, finite(transition.delay))}ms`;
  const filters = rules.filters as Record<string, unknown> | undefined;
  if (filters && typeof filters === "object") resolved.filter = `blur(${Math.max(0, finite(filters.blur))}px) brightness(${Math.max(0, finite(filters.brightness, 100))}%) contrast(${Math.max(0, finite(filters.contrast, 100))}%) grayscale(${Math.max(0, Math.min(100, finite(filters.grayscale)))}%) saturate(${Math.max(0, finite(filters.saturate, 100))}%)`;
  for (const key of ["margin", "padding", "backgroundGradient", "backgroundImageValue", "backgroundOverlay", "shadow", "transformValue", "transitionValue", "filters"]) delete resolved[key];
  return resolved;
}

export function sanitizeStyleRules(rules: BuilderStyleRules): CSSProperties {
  const output: Record<string, string | number> = {};
  for (const [key, raw] of Object.entries(resolveSpecialRules(rules))) {
    if (!allowedCssProperties.has(key as keyof CSSProperties) || raw === undefined || raw === null || raw === "") continue;
    const unitValue = cssUnitToString(raw);
    if (unitValue) output[key] = unitValue;
    else if (typeof raw === "number" || typeof raw === "string" || typeof raw === "boolean") output[key] = typeof raw === "boolean" ? String(raw) : raw;
  }
  return output as CSSProperties;
}

function responsiveLayers(device: BuilderDevice) { return device === "desktop" ? ["desktop"] as const : device === "tablet" ? ["desktop", "tablet"] as const : ["desktop", "tablet", "mobile"] as const; }
function classStyleSet(item: OnlineStoreStyleClass) { return normalizeStyleSet({ base: item.styles || {}, ...(item.states || {}) }); }

export function resolveNodeStyleRules(theme: OnlineStoreTheme | null | undefined, node: BuilderBlock, device: BuilderDevice, state: BuilderStyleState = "base"): BuilderStyleRules {
  const classes = new Map((theme?.style_classes || []).map((item) => [item.id, item]));
  const applied = node.class_ids.flatMap((id) => classes.get(id) ? [classes.get(id)!] : []);
  const themeSettings = (theme?.settings || {}) as Record<string, unknown>;
  const themeDefaults = themeSettings.builder_defaults && typeof themeSettings.builder_defaults === "object" ? themeSettings.builder_defaults as BuilderStyleRules : {};
  let rules: BuilderStyleRules = { ...themeDefaults };
  for (const item of applied) rules = { ...rules, ...classStyleSet(item).base };
  rules = { ...rules, ...normalizeStyleSet(node.style).base };
  for (const breakpoint of responsiveLayers(device)) {
    for (const item of applied) rules = { ...rules, ...((item.responsive?.[breakpoint] as Record<string, unknown> | undefined)?.base as BuilderStyleRules || {}) };
    const nodeResponsive = node.responsive[breakpoint]?.styles as Partial<Record<BuilderStyleState, BuilderStyleRules>> | undefined;
    rules = { ...rules, ...(nodeResponsive?.base || {}) };
  }
  if (state !== "base") {
    for (const item of applied) rules = { ...rules, ...classStyleSet(item)[state] };
    rules = { ...rules, ...normalizeStyleSet(node.style)[state] };
    for (const breakpoint of responsiveLayers(device)) {
      for (const item of applied) rules = { ...rules, ...((item.responsive?.[breakpoint] as Record<string, unknown> | undefined)?.[state] as BuilderStyleRules || {}) };
      const nodeResponsive = node.responsive[breakpoint]?.styles as Partial<Record<BuilderStyleState, BuilderStyleRules>> | undefined;
      rules = { ...rules, ...(nodeResponsive?.[state] || {}) };
    }
  }
  return rules;
}

export function resolveNodeStyles(theme: OnlineStoreTheme | null | undefined, node: BuilderBlock, device: BuilderDevice, state: BuilderStyleState = "base") {
  return sanitizeStyleRules(resolveNodeStyleRules(theme, node, device, state));
}

export function resolveStructuredStyles(style: unknown, responsive: unknown, device: BuilderDevice, state: BuilderStyleState = "base") {
  const styleSet = normalizeStyleSet(style);
  const responsiveSet = responsive && typeof responsive === "object" && !Array.isArray(responsive) ? responsive as BuilderResponsiveStyleSet : {};
  let rules: BuilderStyleRules = { ...styleSet.base };
  for (const breakpoint of responsiveLayers(device)) rules = { ...rules, ...(responsiveSet[breakpoint]?.base || {}) };
  if (state !== "base") {
    rules = { ...rules, ...styleSet[state] };
    for (const breakpoint of responsiveLayers(device)) rules = { ...rules, ...(responsiveSet[breakpoint]?.[state] || {}) };
  }
  return sanitizeStyleRules(rules);
}

export function styleObjectToCss(style: CSSProperties) {
  return Object.entries(style).map(([key, value]) => `${key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}:${String(value).replace(/[{};]/g, "")}`).join(";");
}

export function copyBuilderStyles(node: BuilderBlock) {
  return structuredClone({
    style: normalizeStyleSet(node.style),
    responsive: {
      desktop: { styles: node.responsive.desktop.styles || {} },
      tablet: { styles: node.responsive.tablet.styles || {} },
      mobile: { styles: node.responsive.mobile.styles || {} },
    },
  });
}
export function pasteBuilderStyles(node: BuilderBlock, copied: ReturnType<typeof copyBuilderStyles>): BuilderBlock {
  return {
    ...node,
    style: normalizeStyleSet(copied.style),
    responsive: {
      desktop: { ...node.responsive.desktop, styles: copied.responsive.desktop.styles || {} },
      tablet: { ...node.responsive.tablet, styles: copied.responsive.tablet.styles || {} },
      mobile: { ...node.responsive.mobile, styles: copied.responsive.mobile.styles || {} },
    },
  };
}
