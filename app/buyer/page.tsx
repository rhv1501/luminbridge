import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@/app/types";
import {
  getBuyerProducts,
  getBuyerOrders,
  getBuyerCustomOrders,
  getBuyerProposals,
} from "@/lib/queries";
import BuyerPageClient from "@/app/buyer/BuyerPageClient";

export default async function BuyerPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get("lumina_session");
  if (!session?.value) redirect("/login");

  let user: User;
  try {
    user = JSON.parse(session.value) as User;
  } catch {
    redirect("/login");
  }

  if (user.role !== "buyer") {
    redirect(user.role === "factory" ? "/factory" : "/admin");
  }

  const [
    initialProducts,
    initialOrders,
    initialCustomOrders,
    initialAllProposals,
  ] = await Promise.all([
    getBuyerProducts(),
    getBuyerOrders(user.id),
    getBuyerCustomOrders(user.id),
    getBuyerProposals(user.id),
  ]);

  return (
    <BuyerPageClient
      user={user}
      initialProducts={initialProducts}
      initialOrders={initialOrders}
      initialCustomOrders={initialCustomOrders}
      initialAllProposals={initialAllProposals}
    />
  );
}
