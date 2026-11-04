"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Small shared admin helpers. */

export async function api<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? `Request failed (${r.status})`);
  return j as T;
}

export async function upload(file: Blob, kind: "scan" | "original" | "render" | "portrait" | "other", name = "file"): Promise<{ key: string; url: string }> {
  const fd = new FormData();
  fd.append("file", file, name);
  fd.append("kind", kind);
  const r = await fetch("/api/admin/media", { method: "POST", body: fd });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? "Upload failed");
  return j;
}

/** Save-button state machine: idle → saving → saved / error. */
export function useSaver() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setState("saving");
    setError(null);
    try {
      await fn();
      setState("saved");
      router.refresh();
      setTimeout(() => setState("idle"), 2200);
      return true;
    } catch (e) {
      setError((e as Error).message);
      setState("error");
      return false;
    }
  };
  return { state, error, run };
}

export function SaveStatus({ state, error }: { state: string; error: string | null }) {
  if (state === "saving") return <span className="adm-note">Saving…</span>;
  if (state === "saved") return <span className="adm-saved">Saved — live on the store</span>;
  if (state === "error") return <span className="adm-err">{error}</span>;
  return null;
}

export function Field({ label, children, full, hint }: { label: string; children: React.ReactNode; full?: boolean; hint?: React.ReactNode }) {
  return (
    <label className={`field${full ? " full" : ""}`}>
      <span>{label}</span>
      {children}
      {hint && <small className="adm-note">{hint}</small>}
    </label>
  );
}

export function Options<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string; note?: string }[] }) {
  return (
    <div className="adm-option-grid">
      {options.map((o) => (
        <button type="button" key={o.id} className={`adm-option${value === o.id ? " on" : ""}`} onClick={() => onChange(o.id)}>
          {o.label}
          {o.note && <small>{o.note}</small>}
        </button>
      ))}
    </div>
  );
}

export function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim().toLowerCase();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft("");
  };
  return (
    <div className="input" style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      {value.map((t) => (
        <span key={t} className="adm-pill">
          {t}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={placeholder}
        style={{ border: 0, background: "transparent", outline: "none", flex: 1, minWidth: 80, font: "inherit", color: "inherit" }}
      />
    </div>
  );
}
