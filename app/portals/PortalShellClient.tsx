"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { User as UserType, Order } from "@/app/types";
import NotificationBell from "@/app/components/NotificationBell";

type PortalShellClientProps = {
  user: UserType;
  onLogout: () => void;
  hasNewOrders: (orders: Order[]) => boolean;
  hasNewCustomOrders: (
    customOrders: import("@/app/types").CustomOrder[],
    proposals?: import("@/app/types").CustomOrderProposal[],
  ) => boolean;
  children: React.ReactNode;
};

const roleBadge: Record<string, string> = {
  admin: "bg-violet-100 text-violet-700",
  factory: "bg-amber-100  text-amber-700",
  buyer: "bg-emerald-100 text-emerald-700",
};

const roleLabel: Record<string, string> = {
  admin: "Admin",
  factory: "Factory",
  buyer: "Buyer",
};

function initials(user: UserType) {
  const name = user.company_name || user.email;
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export default function PortalShellClient({
  user,
  onLogout,
  hasNewOrders,
  hasNewCustomOrders,
  children,
}: PortalShellClientProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const userInitials = initials(user);
  const badge = roleBadge[user.role] ?? "bg-zinc-100 text-zinc-500";
  const label = roleLabel[user.role] ?? user.role;

  // Never allow the mobile drawer to remain open on desktop.
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setDrawerOpen(false);
    };
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* ── Navbar ── */}
      <nav className="bg-white border-b border-zinc-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex flex-nowrap items-center justify-between gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 bg-zinc-900 text-white rounded-lg flex items-center justify-center">
              <Globe size={18} />
            </div>
            <span className="font-serif font-bold text-xl tracking-tight whitespace-nowrap">
              LuminaBridge
            </span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Navbar always shows notifications */}
            <NotificationBell
              userId={user.id}
              userRole={user.role}
              hasNewOrders={hasNewOrders}
              hasNewCustomOrders={hasNewCustomOrders}
            />

            {/* Desktop: everything visible inline, no hamburger, no sidebar */}
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 rounded-full border border-zinc-100">
                <div className="w-7 h-7 rounded-full bg-zinc-900 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0 select-none">
                  {userInitials}
                </div>
                <div className="flex flex-col min-w-0">
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full w-fit ${badge}`}
                  >
                    {label}
                  </span>
                  <span className="text-xs font-medium text-zinc-700 leading-none mt-1 max-w-[220px] truncate">
                    {user.company_name || user.email}
                  </span>
                </div>
              </div>

              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:ring-offset-2 rounded-lg px-2 py-1"
              >
                <LogOut size={16} />
                <span className="font-medium">Logout</span>
              </button>
            </div>

            {/* Mobile: hamburger opens sidebar with user + logout */}
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="p-2 text-zinc-500 hover:text-zinc-900 transition-colors focus:outline-none rounded-lg md:hidden"
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Mobile drawer (< md) ── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 bg-black/40 z-50 md:hidden"
            />

            {/* Drawer */}
            <motion.aside
              key="drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 240 }}
              className="fixed top-0 right-0 h-full w-72 bg-white z-50 md:hidden flex flex-col"
            >
              {/* Header */}
              <div className="h-16 flex items-center justify-between px-5 border-b border-zinc-100 flex-shrink-0">
                <span className="font-serif font-bold text-base text-zinc-800">
                  Account
                </span>
                <button
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close menu"
                  className="p-1.5 text-zinc-400 hover:text-zinc-900 transition-colors rounded-lg focus:outline-none"
                >
                  <X size={20} />
                </button>
              </div>

              {/* User card */}
              <div className="px-5 py-6">
                {/* Avatar + name row */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-full bg-zinc-900 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 select-none">
                    {userInitials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-800 truncate leading-tight">
                      {user.company_name || user.email}
                    </p>
                    {user.company_name && (
                      <p className="text-xs text-zinc-400 truncate mt-0.5">
                        {user.email}
                      </p>
                    )}
                  </div>
                </div>

                {/* Role badge */}
                <span
                  className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${badge}`}
                >
                  {label}
                </span>
              </div>

              {/* Details */}
              {(user.mobile_number ||
                user.wechat_id ||
                user.whatsapp_number) && (
                <div className="px-5 pb-4 space-y-3 border-t border-zinc-50 pt-4">
                  {user.mobile_number && (
                    <InfoLine label="Mobile" value={user.mobile_number} />
                  )}
                  {user.wechat_id && (
                    <InfoLine label="WeChat" value={user.wechat_id} />
                  )}
                  {user.whatsapp_number && (
                    <InfoLine label="WhatsApp" value={user.whatsapp_number} />
                  )}
                </div>
              )}

              <div className="flex-1" />

              {/* Sign out */}
              <div className="px-5 pb-6 pt-4 border-t border-zinc-100">
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-zinc-900 text-white text-sm font-semibold hover:bg-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main>{children}</main>

      <footer className="py-12 border-t border-zinc-200 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50">
            <Globe size={16} />
            <span className="font-serif font-bold text-sm">
              LuminaBridge Global
            </span>
          </div>
          <div className="flex gap-8 text-xs font-bold uppercase tracking-widest text-zinc-400">
            <a href="#" className="hover:text-zinc-900 transition-colors">
              Terms
            </a>
            <a href="#" className="hover:text-zinc-900 transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-zinc-900 transition-colors">
              Support
            </a>
          </div>
          <p className="text-xs text-zinc-400">
            © 2026 LuminaBridge B2B. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 w-16 flex-shrink-0">
        {label}
      </span>
      <span className="text-sm text-zinc-700 truncate">{value}</span>
    </div>
  );
}

type IconProps = {
  size?: number;
  className?: string;
};

function Globe({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function LogOut({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function Menu({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function X({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
