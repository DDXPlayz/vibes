import { WishlistView } from "@/components/store/WishlistView";
import { storefrontProducts } from "@/server/catalog";

export const metadata = { title: "Your collection" };

export default async function WishlistPage() {
  return <WishlistView products={await storefrontProducts()} />;
}
