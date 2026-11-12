import type { ReactNode } from "react";
import { requireDashboardUser } from "@/lib/server/dashboard-auth";

export const dynamic = "force-dynamic";

export default async function AdminDashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  // Operational admin pages allow trusted admin and super_admin roles.
  // Sensitive user, top-up and cashout pages add a stricter child layout.
  await requireDashboardUser(["admin", "super_admin"]);
  return <>{children}</>;
}
