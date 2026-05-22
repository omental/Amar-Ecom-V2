export type StorefrontBlockPreset = {
  type: "heading" | "paragraph" | "image" | "button" | "spacer" | "divider";
  label: string;
  description: string;
  defaultConfig: Record<string, unknown>;
};

const BLOCK_PRESETS: StorefrontBlockPreset[] = [
  {
    type: "heading",
    label: "Heading",
    description: "Section heading with level and alignment controls.",
    defaultConfig: { text: "Tell your story", level: "h2", align: "left", column: 1 },
  },
  {
    type: "paragraph",
    label: "Paragraph",
    description: "Short paragraph block for product story, policy, or campaign copy.",
    defaultConfig: {
      text: "Add supporting copy for this landing page section.",
      align: "left",
      column: 1,
    },
  },
  {
    type: "image",
    label: "Image",
    description: "Responsive image block with optional link.",
    defaultConfig: {
      image_url: "",
      alt: "",
      link_url: "",
      radius_preset: "soft",
      column: 2,
    },
  },
  {
    type: "button",
    label: "Button",
    description: "Call-to-action button block.",
    defaultConfig: {
      label: "Shop Now",
      href: "/products",
      style: "primary",
      align: "left",
      column: 1,
    },
  },
  {
    type: "spacer",
    label: "Spacer",
    description: "Vertical spacing block for breathing room.",
    defaultConfig: { size: "md", column: 1 },
  },
  {
    type: "divider",
    label: "Divider",
    description: "Simple visual divider line.",
    defaultConfig: { style: "subtle", column: 1 },
  },
];

export const storefrontBlockPresets = BLOCK_PRESETS;

export function getBlockPreset(type: string) {
  return BLOCK_PRESETS.find((preset) => preset.type === type);
}

export function buildBlockFromPreset(type: string) {
  const preset = getBlockPreset(type);
  if (!preset) {
    return { type, column: 1 };
  }
  return { type: preset.type, ...preset.defaultConfig };
}
