import { promises as fs } from "fs";
import path from "path";
import type { Database } from "@/lib/types";
import { seedDatabase } from "@/lib/seed";
import { hashPassword } from "./password";

/**
 * Repository layer.
 *
 * The prototype persists to a single JSON document on disk so it runs with
 * zero infrastructure. Every read/write goes through `read` / `mutate`, so
 * swapping this file for the PostgreSQL implementation (see
 * prisma/schema.prisma) does not touch any page or route.
 */

export const DATA_DIR = process.env.VIBES_DATA_DIR ?? path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "db.json");

let cache: { db: Database; mtime: number } | null = null;
let queue: Promise<unknown> = Promise.resolve();
let seeding: Promise<Database> | null = null;

async function seed(): Promise<Database> {
  const base = seedDatabase();
  return {
    ...base,
    users: [
      { id: "u-owner", name: "Devika (Owner)", email: "owner@vibes.in", role: "owner", passwordHash: hashPassword(process.env.VIBES_OWNER_PASSWORD ?? "loveyourlegacy") },
      { id: "u-manager", name: "Store manager", email: "manager@vibes.in", role: "manager", passwordHash: hashPassword("manager-demo") },
      { id: "u-staff", name: "Store staff", email: "staff@vibes.in", role: "staff", passwordHash: hashPassword("staff-demo") },
    ],
  };
}

async function load(): Promise<Database> {
  try {
    const stat = await fs.stat(FILE);
    if (cache && cache.mtime === stat.mtimeMs) return cache.db;
    const db = JSON.parse(await fs.readFile(FILE, "utf8")) as Database;
    cache = { db, mtime: stat.mtimeMs };
    return db;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    // several requests can arrive before the first seed is written
    seeding ??= seed().then(async (db) => {
      await persist(db);
      return db;
    });
    return seeding;
  }
}

async function persist(db: Database) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 1));
  await fs.rename(tmp, FILE);
  const stat = await fs.stat(FILE);
  cache = { db, mtime: stat.mtimeMs };
}

export async function read<T>(fn: (db: Database) => T): Promise<T> {
  await queue;
  return fn(await load());
}

/** Serialised read-modify-write. */
export function mutate<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = structuredClone(await load());
    const out = await fn(db);
    await persist(db);
    return out;
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function resetDatabase() {
  await persist(await seed());
}

export function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
