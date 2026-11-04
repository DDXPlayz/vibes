"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { cx } from "@/lib/format";
import { BagIcon, CloseIcon, HeartIcon, MenuIcon, MoonIcon, SearchIcon, SunIcon } from "./Icons";
import { SearchOverlay } from "./SearchOverlay";
import { useStore } from "./StoreProvider";

const NAV = [
  { href: "/collection", label: "Collection" },
  { href: "/craft", label: "The craft" },
  { href: "/artisans", label: "Artisans" },
  { href: "/collection?availability=archive", label: "Archive" },
];

export function Header() {
  const path = usePathname();
  const { theme, toggle } = useTheme();
  const { bag, wishlist } = useStore();
  const [solid, setSolid] = useState(false);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const overHero = path === "/";

  useEffect(() => {
    const on = () => setSolid(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    setMenu(false);
    setSearch(false);
  }, [path]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement))) {
        e.preventDefault();
        setSearch(true);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const count = bag.reduce((n, l) => n + l.quantity, 0);

  return (
    <>
      <header className={cx("header", (solid || !overHero) && "solid")}>
        <div className="wrap header-inner">
          <nav className="nav" aria-label="Primary">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={cx("link", path === n.href.split("?")[0] && n.href.indexOf("?") < 0 && "on")}>
                {n.label}
              </Link>
            ))}
          </nav>
          <button className="icon-btn menu-btn" aria-label="Menu" onClick={() => setMenu(true)}>
            <MenuIcon />
          </button>
          <Link href="/" className="wordmark" aria-label="VIBES — home">
            VIBES
          </Link>
          <div className="header-tools">
            <button className="icon-btn" aria-label="Search" onClick={() => setSearch(true)}>
              <SearchIcon />
            </button>
            <button className="icon-btn hide-sm" aria-label={theme === "dark" ? "Light mode" : "Dark mode"} onClick={toggle}>
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
            <Link href="/wishlist" className="icon-btn hide-sm" aria-label="Your collection">
              <HeartIcon />
              {wishlist.length > 0 && <span className="count">{wishlist.length}</span>}
            </Link>
            <Link href="/bag" className="icon-btn" aria-label="Bag">
              <BagIcon />
              {count > 0 && <span className="count">{count}</span>}
            </Link>
          </div>
        </div>
      </header>
      {menu && (
        <div className="drawer" role="dialog" aria-label="Menu">
          <div className="row" style={{ height: 44 }}>
            <span className="wordmark" style={{ fontSize: 20 }}>VIBES</span>
            <span className="spacer" />
            <button className="icon-btn" aria-label="Close" onClick={() => setMenu(false)}>
              <CloseIcon />
            </button>
          </div>
          <nav style={{ marginTop: 48, display: "grid" }}>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="big">
                {n.label}
              </Link>
            ))}
            <Link href="/wishlist" className="big">Your collection</Link>
          </nav>
          <div className="spacer" />
          <div className="row">
            <button className="btn btn-ghost btn-sm" onClick={toggle}>
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
          </div>
          <p className="serif italic muted" style={{ fontSize: 22, marginTop: 24 }}>Love your legacy.</p>
        </div>
      )}
      {search && <SearchOverlay onClose={() => setSearch(false)} />}
    </>
  );
}
