"use client";

import React from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@/app/types";
import { Login } from "@/app/portals/Login";
import { FactoryDashboard } from "@/app/portals/FactoryDashboard";
import { AdminDashboard } from "@/app/portals/AdminDashboard";
import { BuyerDashboard } from "@/app/portals/BuyerDashboard";
import NotificationBell from "@/app/components/NotificationBell";
import LoginPageClient from "@/app/login/LoginPageClient";
import { PageSpinner } from "@/app/ui/Skeleton";

export {
  Login,
  FactoryDashboard,
  AdminDashboard,
  BuyerDashboard,
  NotificationBell,
};

type AppClientProps = {
  forcedRole?: UserRole | "login";
};

function RedirectByRole({ role }: { role: UserRole }) {
  const router = useRouter();

  useEffect(() => {
    const path =
      role === "factory" ? "/factory" : role === "admin" ? "/admin" : "/buyer";
    router.replace(path);
  }, [role, router]);

  return <PageSpinner />;
}

export default function AppClient({ forcedRole }: AppClientProps = {}) {
  if (forcedRole === "factory") return <RedirectByRole role="factory" />;
  if (forcedRole === "admin") return <RedirectByRole role="admin" />;
  if (forcedRole === "buyer") return <RedirectByRole role="buyer" />;
  if (forcedRole === "login") return <LoginPageClient />;
  return <LoginPageClient />;
}
