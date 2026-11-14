import ProductsManager from "@/components/products-manager";
import { requireDashboardUser } from "@/lib/server/dashboard-auth";

export const dynamic = "force-dynamic";

export default async function ShakhStoreMarketPage() {
  await requireDashboardUser(["super_admin"]);
  return <ProductsManager platformMarket />;
}
