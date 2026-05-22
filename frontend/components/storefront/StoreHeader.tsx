"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import { FormEvent, useState } from "react";

import type { OnlineStoreMenuItem, OnlineStoreSettings } from "@/lib/online-store";

import { useCart } from "./CartProvider";
import { CartDrawer } from "./CartDrawer";

export function StoreHeader({
  settings,
  navigation,
}: {
  settings: OnlineStoreSettings;
  navigation: OnlineStoreMenuItem[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { cartCount } = useCart();
  const [search, setSearch] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();

    if (search.trim()) {
      params.set("search", search.trim());
    }

    router.push(`/products${params.toString() ? `?${params.toString()}` : ""}`);
    setMobileMenuOpen(false);
  };

  const primaryNavLinks = navigation;
  const headerLayout = settings.header_layout || "search_heavy";
  const isCentered = headerLayout === "centered_logo";
  const isMinimal = headerLayout === "minimal";
  const isCategoryFirst = headerLayout === "category_first";
  const desktopGridClass = isCentered
    ? "lg:grid-cols-[1fr_220px_1fr]"
    : isMinimal
      ? "lg:grid-cols-[260px_minmax(0,1fr)_160px]"
      : "lg:grid-cols-[220px_minmax(0,1fr)_170px]";

  return (
    <>
      <header className="border-b border-[#e5e7eb] bg-white">
        <div className="mx-auto max-w-[1200px] px-4 py-4 sm:px-5">
          <div className={`grid items-center gap-4 ${desktopGridClass}`}>
            <div className={`flex items-center justify-between gap-3 ${isCentered ? "lg:justify-start" : "lg:block"}`}>
              <Link href="/" className="text-[1.9rem] font-extrabold tracking-tight text-black">
                {settings.brand_name?.split("-")[0] || "Amar"}-
                <span className="text-[#db011c]">
                  {settings.brand_name?.split("-")[1] || "eCom"}
                </span>
              </Link>

              <button
                type="button"
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                onClick={() => setMobileMenuOpen((value) => !value)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#e5e7eb] text-black lg:hidden"
              >
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>

            {settings.show_search && !isMinimal ? (
              <form
                onSubmit={handleSubmit}
                className={`flex items-center rounded-md border border-[#d1d5db] bg-white px-3 ${isCentered ? "lg:order-3" : ""}`}
              >
                <Search className="h-4 w-4 text-[#6b7280]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search products..."
                  className="h-11 w-full bg-transparent px-3 text-sm text-black outline-none placeholder:text-[#9ca3af]"
                />
              </form>
            ) : (
              <div />
            )}

            <div className={`hidden lg:flex ${isCentered ? "justify-center" : "justify-end"}`}>
              {isMinimal && settings.show_search ? (
                <form
                  onSubmit={handleSubmit}
                  className="mr-3 flex w-full max-w-[280px] items-center rounded-md border border-[#d1d5db] bg-white px-3"
                >
                  <Search className="h-4 w-4 text-[#6b7280]" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search products..."
                    className="h-11 w-full bg-transparent px-3 text-sm text-black outline-none placeholder:text-[#9ca3af]"
                  />
                </form>
              ) : null}
              {settings.show_cart ? (
                <button
                  type="button"
                  onClick={() => setCartOpen(true)}
                  className="relative inline-flex items-center gap-2 rounded-md bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#db011c]"
                >
                  <ShoppingBag className="h-4 w-4" />
                  <span>Cart</span>
                  <span className="absolute -right-2 -top-2 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#db011c] px-1 text-[10px] font-bold text-white">
                    {cartCount}
                  </span>
                </button>
              ) : null}
            </div>
          </div>

          <div className={`${mobileMenuOpen ? "mt-4 block" : "hidden"} lg:hidden`}>
            <nav className="flex flex-col gap-2 border-t border-[#e5e7eb] pt-4">
              {primaryNavLinks.map((link) => {
                const active = pathname === link.url;
                return (
                  <Link
                    key={`${link.label}-${link.url}`}
                    href={link.url}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`rounded-md px-3 py-2 text-sm font-semibold ${
                      active ? "bg-[#fff1f3] text-[#db011c]" : "text-black"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <div className="flex gap-2 pt-2">
                {settings.show_track_order ? (
                  <Link
                    href="/track-order"
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex flex-1 items-center justify-center rounded-md border border-[#e5e7eb] px-4 py-2.5 text-sm font-semibold text-black"
                  >
                    Track Order
                  </Link>
                ) : null}
                {settings.show_cart ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCartOpen(true);
                      setMobileMenuOpen(false);
                    }}
                    className="inline-flex flex-1 items-center justify-center rounded-md bg-black px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Cart ({cartCount})
                  </button>
                ) : null}
              </div>
            </nav>
          </div>
        </div>

        <div className={`border-t border-[#e5e7eb] ${isCategoryFirst ? "bg-[#fafafa]" : ""}`}>
          <nav className={`mx-auto hidden max-w-[1200px] items-center px-4 sm:px-5 lg:flex ${isCentered ? "justify-center gap-8" : "gap-7"}`}>
            {primaryNavLinks.map((link) => {
              const active = pathname === link.url;

              return (
                <Link
                  key={`${link.label}-${link.url}`}
                  href={link.url}
                  className={`relative inline-flex h-12 items-center text-sm font-semibold transition ${
                    active ? "text-[#db011c]" : "text-black hover:text-[#db011c]"
                  }`}
                >
                  {link.label}
                  <span
                    className={`absolute bottom-0 left-0 h-[2px] w-full rounded-full bg-[#db011c] transition ${
                      active ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
