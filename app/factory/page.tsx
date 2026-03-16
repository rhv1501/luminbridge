import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@/app/types";
import {
  getFactoryProducts,
  getFactoryOrders,
  getFactoryCustomOrders,
} from "@/lib/queries";
import FactoryPageClient from "@/app/factory/FactoryPageClient";

export default async function FactoryPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get("lumina_session");
  if (!session?.value) redirect("/factory/login");

  let user: User;
  try {
    user = JSON.parse(session.value) as User;
  } catch {
    redirect("/factory/login");
  }

  if (user.role !== "factory") {
    redirect(user.role === "admin" ? "/admin" : "/buyer");
  }

  const [initialProducts, initialOrders, initialCustomOrders] =
    await Promise.all([
      getFactoryProducts(user.id),
      getFactoryOrders(user.id),
      getFactoryCustomOrders(),
    ]);

  return (
    <FactoryPageClient
      user={user}
      initialProducts={initialProducts}
      initialOrders={initialOrders}
      initialCustomOrders={initialCustomOrders}
    />
  );
}
