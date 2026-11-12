import type { ReactNode } from "react";
import { requireDashboardUser } from "@/lib/server/dashboard-auth";

export const dynamic = "force-dynamic";

export default async function ProductManagementLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireDashboardUser([
    "restaurant",
    "supermarket",
    "produce_vendor",
    "meat_seafood_vendor",
    "admin",
    "super_admin",
  ]);
  return <>{children}</>;
}
