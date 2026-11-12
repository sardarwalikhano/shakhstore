import type { ReactNode } from "react";
import { requireDashboardUser } from "@/lib/server/dashboard-auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireDashboardUser();
  return <>{children}</>;
}
