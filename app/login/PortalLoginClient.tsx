"use client";

import { useRouter } from "next/navigation";
import { Login } from "@/app/portals/Login";
import type { User, UserRole } from "@/app/types";

const rolePath = (role: UserRole) => {
  if (role === "factory") return "/factory";
  if (role === "admin") return "/admin";
  return "/buyer";
};

type Props = {
  role: UserRole;
  allowSignup?: boolean;
  showAdminPortalLinks?: boolean;
};

export default function PortalLoginClient({
  role,
  allowSignup = false,
  showAdminPortalLinks = false,
}: Props) {
  const router = useRouter();

  return (
    <div>
      <Login
        initialRole={role}
        lockedRole={role}
        allowSignup={allowSignup}
        showPortalSwitch={false}
        showDemoAccounts={true}
        onLogin={(user: User) => {
          // Cookie is already set by POST /api/auth/login response.
          localStorage.setItem("lumina_user", JSON.stringify(user));
          router.replace(rolePath(user.role));
        }}
      />

      {showAdminPortalLinks && (
        <div className="-mt-10 pb-10 flex justify-center">
          <div className="text-xs text-zinc-500">
            Other portals:{" "}
            <a className="underline hover:text-zinc-900" href="/buyer/login">
              Buyer
            </a>
            {" · "}
            <a className="underline hover:text-zinc-900" href="/factory/login">
              Factory
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
