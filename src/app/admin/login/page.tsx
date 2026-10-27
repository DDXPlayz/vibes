"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import "../admin.css";

function Login() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/admin";
  const [email, setEmail] = useState("owner@vibes.in");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="adm-login">
      <form
        className="adm-login-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const r = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
          setBusy(false);
          if (!r.ok) return setError((await r.json()).error);
          router.replace(next.startsWith("/admin") ? next : "/admin");
          router.refresh();
        }}
      >
        <div className="wordmark" style={{ fontSize: 28 }}>VIBES</div>
        <p className="label" style={{ marginTop: 8 }}>Studio</p>
        <label className="field" style={{ marginTop: 40 }}>
          <span>Email</span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </label>
        <label className="field" style={{ marginTop: 20 }}>
          <span>Password</span>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required autoFocus />
        </label>
        {error && <p style={{ color: "var(--bad)", fontSize: 13 }}>{error}</p>}
        <button className="btn btn-block" style={{ marginTop: 32 }} disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="muted" style={{ fontSize: 12, marginTop: 24, lineHeight: 1.6 }}>
          Demo accounts — owner@vibes.in / loveyourlegacy · manager@vibes.in / manager-demo · staff@vibes.in / staff-demo
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}
