"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { cx } from "@/lib/format";

export const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/collections", label: "Collections" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/artisans", label: "Artisans" },
  { sep: true },
  { href: "/admin/studio", label: "Digital Studio" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/settings", label: "Settings" },
] as const;

export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="adm-nav" aria-label="Studio">
      {ADMIN_NAV.map((n, i) =>
        "sep" in n ? (
          <div key={i} className="sep" />
        ) : (
          <Link key={n.href} href={n.href} onClick={onNavigate} className={cx((n.href === "/admin" ? path === "/admin" : path.startsWith(n.href)) && "on")}>
            {n.label}
          </Link>
        ),
      )}
    </nav>
  );
}

export function AdminTop({ name }: { name: string }) {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="adm-top">
        <button className="btn btn-ghost btn-sm adm-mobile-nav" onClick={() => setOpen(!open)}>
          Menu
        </button>
        <Link href="/admin/products/new" className="btn btn-sm">
          + Add a saree
        </Link>
        <span className="spacer" />
        <button className="link" onClick={toggle}>{theme === "dark" ? "Light" : "Dark"}</button>
        <Link href="/" className="link" target="_blank">
          View store ↗
        </Link>
        <button
          className="link"
          title={name}
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            router.replace("/admin/login");
          }}
        >
          Sign out
        </button>
      </header>
      {open && (
        <div className="adm-mobile-nav" style={{ padding: 12, borderBottom: "1px solid var(--line)", background: "var(--surface-2)" }}>
          <AdminNav onNavigate={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
