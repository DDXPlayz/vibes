import { Checkout } from "@/components/store/Checkout";
import { storefrontProducts } from "@/server/catalog";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  return <Checkout products={await storefrontProducts()} />;
}
