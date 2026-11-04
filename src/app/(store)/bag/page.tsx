import { BagView } from "@/components/store/BagView";
import { storefrontProducts } from "@/server/catalog";

export const metadata = { title: "Your bag" };

export default async function BagPage() {
  return <BagView products={await storefrontProducts()} />;
}
