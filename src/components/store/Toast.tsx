"use client";

import Link from "next/link";
import { useStore } from "./StoreProvider";

export function Toast() {
  const { toast } = useStore();
  if (!toast) return null;
  return (
    <div className="toast" role="status">
      <span>{toast.text}</span>
      {toast.href && <Link href={toast.href}>{toast.cta ?? "View"}</Link>}
    </div>
  );
}
