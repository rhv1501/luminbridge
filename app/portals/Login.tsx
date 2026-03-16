"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import { Globe } from "lucide-react";
import { Card } from "@/app/ui/Card";
import { Button } from "@/app/ui/Button";
import { Input } from "@/app/ui/Input";
import { cn } from "@/app/ui/cn";
import { User as UserType, UserRole } from "@/app/types";

export const Login = ({
  onLogin,
  initialRole = "buyer",
  lockedRole,
  allowSignup = true,
  showPortalSwitch,
  showDemoAccounts = true,
}: {
  onLogin: (user: UserType) => void;
  initialRole?: UserRole;
  lockedRole?: UserRole;
  allowSignup?: boolean;
  showPortalSwitch?: boolean;
  showDemoAccounts?: boolean;
}) => {
  const [isSignup, setIsSignup] = useState(false);
  const effectiveRole = lockedRole ?? initialRole;
  const [role, setRole] = useState<UserRole>(effectiveRole);
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [wechatId, setWechatId] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (isSignup) {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            role,
            company_name: companyName,
            wechat_id: wechatId,
            mobile_number: mobileNumber,
            whatsapp_number: whatsappNumber,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Signup failed");
          return;
        }

        // Create a real session after signup.
        const loginRes = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, role }),
        });

        if (!loginRes.ok) {
          const data = await loginRes.json().catch(() => ({}));
          setError(data.error || "Unable to start session");
          return;
        }

        const user = await loginRes.json();
        onLogin(user);
        return;
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message = data.error || "Invalid email";
        setError(
          message === "User not found"
            ? "User not found. If you're running locally, run npm run db:migrate to create the demo users."
            : message,
        );
        return;
      }

      const user = await res.json();
      onLogin(user);
    } catch (err) {
      console.error(err);
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-zinc-900 text-white rounded-2xl mb-4">
            <Globe size={32} />
          </div>
          <h1 className="text-3xl font-serif font-bold">LuminaBridge</h1>
          <p className="text-zinc-500 mt-2 italic">
            {role === "admin"
              ? "Admin Portal"
              : role === "factory"
                ? "Factory Portal"
                : "Buyer Portal"}
          </p>
        </div>

        <Card className="p-6 sm:p-8">
          {allowSignup && (
            <div className="flex bg-zinc-100 p-1 rounded-lg mb-6">
              <button
                onClick={() => setIsSignup(false)}
                className={cn(
                  "flex-1 py-2 text-sm font-medium rounded-md transition-all",
                  !isSignup
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700",
                )}
              >
                Sign In
              </button>
              <button
                onClick={() => setIsSignup(true)}
                className={cn(
                  "flex-1 py-2 text-sm font-medium rounded-md transition-all",
                  isSignup
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700",
                )}
              >
                Sign Up
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div className="space-y-4 mb-4">
                <Input
                  label="Company Name"
                  placeholder="Your company name"
                  value={companyName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setCompanyName(e.target.value)
                  }
                  required
                />
              </div>
            )}

            <Input
              label="Email Address"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setEmail(e.target.value)
              }
              required
            />

            {isSignup && role === "factory" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="WeChat ID"
                  placeholder="ID"
                  value={wechatId}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setWechatId(e.target.value)
                  }
                  required
                />
                <Input
                  label="Mobile Number"
                  placeholder="Number"
                  value={mobileNumber}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setMobileNumber(e.target.value)
                  }
                  required
                />
              </div>
            )}

            {isSignup && role === "buyer" && (
              <Input
                label="WhatsApp Number"
                placeholder="Include country code"
                value={whatsappNumber}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setWhatsappNumber(e.target.value)
                }
                required
              />
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? isSignup
                  ? "Creating account..."
                  : "Signing in..."
                : isSignup
                  ? "Create Account"
                  : "Sign In"}
            </Button>
          </form>

          {(showPortalSwitch ?? !lockedRole) && (
            <div className="mt-6 pt-6 border-t border-zinc-100 text-center">
              <button
                onClick={() => {
                  if (lockedRole) return;
                  setRole(role === "buyer" ? "factory" : "buyer");
                  setIsSignup(false);
                  setError("");
                }}
                className="text-sm text-zinc-500 hover:text-zinc-900 underline"
              >
                {role === "buyer"
                  ? "Are you a factory? Go to Factory Portal"
                  : "Are you a buyer? Go to Buyer Portal"}
              </button>
            </div>
          )}

          {showDemoAccounts && !isSignup && (
            <div className="mt-6 pt-6 border-t border-zinc-100">
              <p className="text-xs text-zinc-400 text-center uppercase tracking-widest font-bold">
                Demo Accounts
              </p>
              <div className="grid grid-cols-1 gap-2 mt-4">
                {(lockedRole ? lockedRole === "admin" : true) && (
                  <button
                    onClick={() => {
                      setEmail("admin@lumina.com");
                      if (!lockedRole) setRole("admin");
                    }}
                    className="text-xs text-zinc-600 hover:text-zinc-900 text-left px-2 py-1 rounded hover:bg-zinc-50 transition-colors"
                  >
                    Admin: admin@lumina.com
                  </button>
                )}
                {(lockedRole ? lockedRole === "factory" : true) && (
                  <button
                    onClick={() => {
                      setEmail("factory@china.com");
                      if (!lockedRole) setRole("factory");
                    }}
                    className="text-xs text-zinc-600 hover:text-zinc-900 text-left px-2 py-1 rounded hover:bg-zinc-50 transition-colors"
                  >
                    Factory: factory@china.com
                  </button>
                )}
                {(lockedRole ? lockedRole === "buyer" : true) && (
                  <button
                    onClick={() => {
                      setEmail("buyer@india.com");
                      if (!lockedRole) setRole("buyer");
                    }}
                    className="text-xs text-zinc-600 hover:text-zinc-900 text-left px-2 py-1 rounded hover:bg-zinc-50 transition-colors"
                  >
                    Buyer: buyer@india.com
                  </button>
                )}
              </div>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
};
