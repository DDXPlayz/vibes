import { ArtisansManager } from "@/components/admin/Managers";
import { read } from "@/server/db";

export const metadata = { title: "Artisans" };

export default async function Artisans() {
  const data = await read((db) => ({ artisans: db.artisans, counts: Object.fromEntries(db.artisans.map((a) => [a.id, db.products.filter((p) => p.artisanId === a.id).length])) }));
  return <ArtisansManager {...data} />;
}
