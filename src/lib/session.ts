import type { Role } from "./types";

/**
 * Signed session tokens (HMAC-SHA256 via Web Crypto) so the same code runs
 * in middleware (edge) and in route handlers (node).
 */

export const SESSION_COOKIE = "vibes_session";
const SECRET = process.env.VIBES_SESSION_SECRET ?? "dev-only-secret-change-me-in-production";

export interface Session {
  uid: string;
  name: string;
  role: Role;
  exp: number;
}

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function key() {
  return crypto.subtle.importKey("raw", enc.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signSession(s: Omit<Session, "exp">, days = 7) {
  const payload = b64url(enc.encode(JSON.stringify({ ...s, exp: Date.now() + days * 864e5 })));
  const sig = await crypto.subtle.sign("HMAC", await key(), enc.encode(payload));
  return `${payload}.${b64url(sig)}`;
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(), fromB64url(sig), enc.encode(payload));
    if (!ok) return null;
    const s = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as Session;
    return s.exp > Date.now() ? s : null;
  } catch {
    return null;
  }
}

const RANK: Record<Role, number> = { staff: 1, manager: 2, owner: 3 };
export function can(role: Role, min: Role) {
  return RANK[role] >= RANK[min];
}
