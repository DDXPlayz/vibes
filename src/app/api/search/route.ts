import { NextResponse } from "next/server";
import { applyFilters, describe, parseQuery } from "@/lib/search";
import { storefrontProducts } from "@/server/catalog";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? 24);
  const filters = parseQuery(q);
  const all = applyFilters(await storefrontProducts(), filters);
  return NextResponse.json({ query: q, filters, chips: describe(filters), total: all.length, results: all.slice(0, limit) });
}
