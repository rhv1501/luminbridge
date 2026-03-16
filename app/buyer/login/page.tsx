import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@/app/types";
import PortalLoginClient from "@/app/login/PortalLoginClient";

export default async function BuyerLoginPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get("lumina_session");
  if (session?.value) {
    try {
      const user = JSON.parse(session.value) as User;
      if (user.role === "factory") redirect("/factory");
      if (user.role === "admin") redirect("/admin");
      redirect("/buyer");
    } catch {
      // invalid cookie – fall through to show login
    }
  }

  return <PortalLoginClient role="buyer" allowSignup={true} />;
}
