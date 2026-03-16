import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@/app/types";
import {
  getAdminProducts,
  getAdminOrders,
  getAdminCustomOrders,
  getSettings,
} from "@/lib/queries";
import AdminPageClient from "@/app/admin/AdminPageClient";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get("lumina_session");
  if (!session?.value) redirect("/admin/login");

  let user: User;
  try {
    user = JSON.parse(session.value) as User;
  } catch {
    redirect("/admin/login");
  }

  if (user.role !== "admin") {
    redirect(user.role === "factory" ? "/factory" : "/buyer");
  }

  const [initialProducts, initialOrders, initialCustomOrders, initialSettings] =
    await Promise.all([
      getAdminProducts(),
      getAdminOrders(),
      getAdminCustomOrders(),
      getSettings(),
    ]);

  return (
    <AdminPageClient
      user={user}
      initialProducts={initialProducts}
      initialOrders={initialOrders}
      initialCustomOrders={initialCustomOrders}
      initialSettings={initialSettings}
    />
  );
}
