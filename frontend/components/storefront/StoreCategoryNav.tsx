import Link from "next/link";

import type { OnlineStoreMenuItem } from "@/lib/online-store";

export function StoreCategoryNav({ items }: { items: OnlineStoreMenuItem[] }) {
  return (
    <div className="border-b border-[#e5e7eb] bg-white">
      <div className="mx-auto max-w-[1200px] px-4 py-2.5 sm:px-5">
        <div className="no-scrollbar flex min-h-10 items-center gap-5 overflow-x-auto whitespace-nowrap text-[13px] text-black">
          {items.map((item) => (
            <Link
              key={`${item.label}-${item.url}`}
              href={item.url}
              className="transition hover:text-[#db011c]"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
