import { NextResponse } from "next/server";
import type { Order } from "@/lib/types";
import { mutate, newId } from "@/server/db";
import { availableQty, reserve } from "@/server/inventory";

interface Body {
  lines: { productId: string; quantity: number }[];
  customer: { name: string; email: string; phone: string };
  address: { line1: string; city: string; state: string; pincode: string };
  note?: string;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const { customer, address } = body;
  if (!body.lines?.length) return NextResponse.json({ error: "Your bag is empty." }, { status: 400 });
  if (!customer?.name || !/^\S+@\S+\.\S+$/.test(customer?.email ?? "") || !address?.line1 || !address?.city || !/^\d{6}$/.test(address?.pincode ?? ""))
    return NextResponse.json({ error: "Please complete your name, email, address and a 6-digit PIN code." }, { status: 400 });

  try {
    const order = await mutate((db) => {
      const lines: Order["lines"] = [];
      for (const l of body.lines) {
        const p = db.products.find((x) => x.id === l.productId && x.status === "published");
        if (!p) throw new Error("One of the sarees is no longer listed.");
        const qty = Math.max(1, Math.floor(l.quantity));
        if (availableQty(p) < qty) throw new Error(`${p.name} has just been reserved by someone else.`);
        lines.push({ productId: p.id, name: p.name, price: p.price, quantity: qty });
      }
      // price and stock come from the server, never the client
      for (const l of lines) reserve(db.products.find((x) => x.id === l.productId)!, l.quantity);
      let c = db.customers.find((x) => x.email.toLowerCase() === customer.email.toLowerCase());
      if (!c) {
        c = { id: newId("cu"), name: customer.name, email: customer.email, phone: customer.phone, city: address.city, createdAt: new Date().toISOString() };
        db.customers.push(c);
      }
      const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
      const o: Order = {
        id: newId("o"),
        number: `VB-${10021 + db.orders.length}`,
        customerId: c.id,
        lines,
        subtotal,
        shipping: 0,
        total: subtotal,
        status: "pending",
        address: { name: customer.name, phone: customer.phone, ...address },
        note: body.note,
        createdAt: new Date().toISOString(),
      };
      db.orders.push(o);
      return o;
    });
    return NextResponse.json({ order });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
