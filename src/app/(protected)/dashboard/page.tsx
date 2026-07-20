import { redirect } from "next/navigation";

export default async function DashboardRootPage() {
  // Bypassing auth to route directly to dashboard
  redirect("/dashboard/mock-session");
}
