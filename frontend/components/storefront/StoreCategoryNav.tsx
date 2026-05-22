import Link from "next/link";

import type { OnlineStoreMenuItem, OnlineStoreSettings } from "@/lib/online-store";

export function StoreCategoryNav({
  items,
  settings,
}: {
  items: OnlineStoreMenuItem[];
  settings?: OnlineStoreSettings;
}) {
  const categoryFirst = settings?.header_layout === "category_first";
  return (
    <div className={`border-b border-[#e5e7eb] ${categoryFirst ? "bg-[#111111]" : "bg-white"}`}>
      <div className="mx-auto max-w-[1200px] px-4 py-2.5 sm:px-5">
        <div className={`no-scrollbar flex min-h-10 items-center gap-5 overflow-x-auto whitespace-nowrap text-[13px] ${categoryFirst ? "text-white" : "text-black"}`}>
          {items.map((item) => (
            <Link
              key={`${item.label}-${item.url}`}
              href={item.url}
              className={`transition ${categoryFirst ? "hover:text-[#fca5a5]" : "hover:text-[#db011c]"}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
