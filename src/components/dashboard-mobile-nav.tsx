"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bike, LayoutDashboard, Package, ShoppingBag, UserCircle } from "lucide-react";

type Props = { role: string };

export function DashboardMobileNav({ role }: Props) {
  const pathname = usePathname();
  const items = [
    { href: "/dashboard", label: "داشبۆرد", icon: LayoutDashboard },
    { href: "/dashboard/orders", label: "داواکاری", icon: ShoppingBag },
    ...(role === "customer" ? [{ href: "/market", label: "بازاڕ", icon: Package }] : []),
    ...(role === "captain" ? [{ href: "/dashboard/captain/deliveries", label: "گەیاندن", icon: Bike }] : []),
    ...(["admin", "super_admin", "restaurant", "supermarket", "produce_vendor", "meat_seafood_vendor"].includes(role)
      ? [{ href: "/dashboard/products", label: "بەرهەم", icon: Package }]
      : []),
    { href: "/profile", label: "پرۆفایل", icon: UserCircle },
  ].slice(0, 5);

  return (
    <nav aria-label="گەشتکردنی مۆبایل" className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}>
      <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-bold transition ${active ? "bg-orange-50 text-orange-700" : "text-slate-500 hover:bg-slate-50"}`}>
              <Icon size={19} strokeWidth={active ? 2.5 : 2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
