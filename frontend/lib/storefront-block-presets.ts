import { blockDefinitions, createBlockFromRegistry, getBlockDefinition } from "@/lib/storefront-block-registry";
import type { BuilderBlockType } from "@/lib/storefront-builder";

export type StorefrontBlockPreset = {
  type: BuilderBlockType;
  label: string;
  description: string;
  defaultConfig: Record<string, unknown>;
};

export const storefrontBlockPresets: StorefrontBlockPreset[] = blockDefinitions.map((definition) => ({
  type: definition.type,
  label: definition.label,
  description: definition.description,
  defaultConfig: definition.defaultProps,
}));

export function getBlockPreset(type: string) {
  const definition = getBlockDefinition(type);
  return definition ? {
    type: definition.type,
    label: definition.label,
    description: definition.description,
    defaultConfig: definition.defaultProps,
  } : undefined;
}

export function buildBlockFromPreset(type: string) {
  return createBlockFromRegistry((getBlockDefinition(type)?.type || "paragraph") as BuilderBlockType);
}
