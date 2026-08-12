import type { StoreSummary } from "@/lib/tenant";

export function normalizeStoreSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/g, "");
}

export type SlugAvailability = { slug: string; available: boolean };

export type MerchantSignupResponse = {
  message: string;
  verification_required: boolean;
  verification_token: string | null;
  store_name: string;
  store_slug: string;
  future_store_url: string;
  storefront_url: string;
};

export type AccountState = {
  email_verified: boolean;
  has_store: boolean;
  requires_provisioning: boolean;
};

export type OnboardingStep = {
  key: "add_product" | "customize_storefront" | "configure_delivery" | "business_information" | "preview_store" | "publish_storefront";
  label: string;
  completed: boolean;
  derived: boolean;
  href: string;
};

export type OnboardingProgress = {
  status: string;
  current_step: string;
  completed_steps: string[];
  steps: OnboardingStep[];
  dismissed_at: string | null;
  completed_at: string | null;
  completion_percent: number;
};

export type ProvisionedStoreResponse = {
  organization_name: string;
  store: StoreSummary;
};
