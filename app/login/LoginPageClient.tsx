"use client";
import { useRouter } from "next/navigation";
import { Login } from "@/app/portals/Login";
import { UserRole } from "@/app/types";

const rolePath = (role: UserRole) => {
  if (role === "factory") return "/factory";
  if (role === "admin") return "/admin";
  return "/buyer";
};

export default function LoginPageClient() {
  const router = useRouter();

  return (
    <Login
      initialRole="buyer"
      onLogin={(user) => {
        // Cookie is already set by POST /api/auth/login response.
        // Store locally so seen-tracking survives page reloads.
        localStorage.setItem("lumina_user", JSON.stringify(user));
        router.replace(rolePath(user.role));
      }}
    />
  );
}
