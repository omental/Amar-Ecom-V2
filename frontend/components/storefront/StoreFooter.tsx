import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";

import type { OnlineStoreMenuItem, OnlineStoreSettings } from "@/lib/online-store";

export function StoreFooter({
  settings,
  footerServices,
  footerJoinUs,
  footerSocial,
}: {
  settings: OnlineStoreSettings;
  footerServices: OnlineStoreMenuItem[];
  footerJoinUs: OnlineStoreMenuItem[];
  footerSocial: OnlineStoreMenuItem[];
}) {
  const footerLayout = settings.footer_layout || "multi_column";
  const socialItems = footerSocial.length > 0 ? footerSocial : [{ label: "Fb", url: "#" }, { label: "X", url: "#" }, { label: "YT", url: "#" }, { label: "IG", url: "#" }];

  if (footerLayout === "simple") {
    return (
      <footer className="mt-12 border-t border-[#e5e7eb] bg-[#f8f8f8]">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-5 px-4 py-8 text-sm text-[#4b5563] sm:px-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-base font-bold text-black">{settings.brand_name}</p>
            <p className="mt-1">{settings.footer_description || "Compact LiveShopping storefront, ready for COD orders."}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {footerServices.slice(0, 4).map((link) => (
              <Link key={link.label} href={link.url} className="font-medium text-[#374151] transition hover:text-[#db011c]">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="mx-auto max-w-[1200px] border-t border-[#e5e7eb] px-4 py-4 text-xs text-[#6b7280] sm:px-5">
          {settings.footer_copyright_text || "Powered by Amar-eCom"}
        </div>
      </footer>
    );
  }

  if (footerLayout === "brand_story") {
    return (
      <footer className="mt-12 border-t border-[#e5e7eb] bg-[#fcfcfc]">
        <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-10 sm:px-5 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr]">
          <div className="space-y-4">
            <h3 className="text-xl font-black tracking-tight text-black">{settings.brand_name}</h3>
            <p className="max-w-xl text-sm leading-7 text-[#4b5563]">
              {settings.footer_description || "A cleaner editorial footer for premium storefront storytelling, paired with practical commerce actions."}
            </p>
            <div className="flex items-center gap-3">
              {socialItems.map((item) => (
                <a key={item.label} href={item.url} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d1d5db] bg-white text-black transition hover:border-[#db011c] hover:text-[#db011c]">
                  <span className="text-xs font-bold">{item.label.slice(0, 2).toUpperCase()}</span>
                </a>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-base font-bold text-black">Contact</h3>
            <div className="mt-3 space-y-2.5 text-sm text-[#374151]">
              <p className="flex items-start gap-2"><Mail className="mt-0.5 h-4 w-4 text-[#db011c]" /><span>{settings.email || "email@amar-ecom.com"}</span></p>
              <p className="flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 text-[#db011c]" /><span>{settings.phone || "+880 1711-000000"}</span></p>
              <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-[#db011c]" /><span>{settings.address || "Dhaka, Bangladesh"}</span></p>
            </div>
          </div>
          {[{ title: "Services & Help", links: footerServices }, { title: "Join Us", links: footerJoinUs }].map((group) => (
            <div key={group.title}>
              <h3 className="text-base font-bold text-black">{group.title}</h3>
              <div className="mt-3 space-y-2 text-sm text-[#374151]">
                {group.links.map((link) => (
                  <Link key={link.label} href={link.url} className="block transition hover:text-[#db011c]">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mx-auto max-w-[1200px] border-t border-[#e5e7eb] px-4 py-4 text-xs text-[#6b7280] sm:px-5">
          {settings.footer_copyright_text || "Powered by Amar-eCom"}
        </div>
      </footer>
    );
  }

  return (
    <footer className="mt-12 border-t border-[#e5e7eb] bg-[#f8f8f8]">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-10 sm:px-5 lg:grid-cols-5">
        <div>
          <h3 className="text-base font-bold text-black">Brand Description</h3>
          <p className="mt-3 text-sm leading-6 text-[#4b5563]">
            {settings.footer_description || "Amar-eCom brings compact, offer-heavy Bangladesh fashion shopping with fast product discovery and order-first browsing."}
          </p>
        </div>

        <div>
          <h3 className="text-base font-bold text-black">Contact</h3>
          <div className="mt-3 space-y-2.5 text-sm text-[#374151]">
            <p className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 text-[#db011c]" />
              <span>{settings.email || "email@amar-ecom.com"}</span>
            </p>
            <p className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 text-[#db011c]" />
              <span>{settings.phone || "+880 1711-000000"}</span>
            </p>
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-[#db011c]" />
              <span>{settings.address || "Dhaka, Bangladesh"}</span>
            </p>
          </div>
        </div>

        {[
          { title: "Services & Help", links: footerServices },
          { title: "Join Us", links: footerJoinUs },
        ].map((group) => (
          <div key={group.title}>
            <h3 className="text-base font-bold text-black">{group.title}</h3>
            <div className="mt-3 space-y-2 text-sm text-[#374151]">
              {group.links.map((link) => (
                <Link
                  key={link.label}
                  href={link.url}
                  className="block transition hover:text-[#db011c]"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}

        <div>
          <h3 className="text-base font-bold text-black">Social Us</h3>
          <div className="mt-3 flex items-center gap-3">
            {socialItems.map((item) => (
              <a
                key={item.label}
                href={item.url}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d1d5db] bg-white text-black transition hover:border-[#db011c] hover:text-[#db011c]"
              >
                <span className="text-xs font-bold">{item.label.slice(0, 2).toUpperCase()}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-[1200px] border-t border-[#e5e7eb] px-4 py-4 text-xs text-[#6b7280] sm:px-5">
        {settings.footer_copyright_text || "Powered by Amar-eCom"}
      </div>
    </footer>
  );
}
