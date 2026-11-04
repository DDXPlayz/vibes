import { ContentEditor } from "@/components/admin/ContentEditor";
import { read } from "@/server/db";

export const metadata = { title: "Content" };

export default async function ContentPage() {
  const data = await read((db) => ({
    content: db.content,
    products: db.products.filter((p) => p.status === "published").map((p) => ({ id: p.id, name: p.name })),
    collections: db.collections.map((c) => ({ id: c.id, name: c.name })),
    artisans: db.artisans.map((a) => ({ id: a.id, name: a.name })),
    stories: db.stories,
  }));
  return <ContentEditor {...data} />;
}
