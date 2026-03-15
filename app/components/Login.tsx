"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

export default function Login({
  onLogin,
}: {
  onLogin: (u: {
    id: number;
    role: string;
    name: string;
    email: string;
  }) => void;
}) {
  const [isSignup, setIsSignup] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ name?: string; email: string; password: string }>({
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = async (values: {
    name?: string;
    email: string;
    password: string;
  }) => {
    setAuthError(null);

    const endpoint = isSignup ? "/api/auth/signup" : "/api/auth/login";
    const payload = isSignup
      ? {
          name: values.name?.trim() || "",
          email: values.email.trim(),
          password: values.password,
        }
      : {
          email: values.email.trim(),
          password: values.password,
        };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setAuthError(data?.error || "Authentication failed");
      return;
    }

    const user = (await res.json()) as {
      id: number;
      role: string;
      name: string;
      email: string;
    };

    onLogin(user);
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6">
        <div className="space-y-3">
          <div>
            <h1 className="text-2xl font-bold font-serif text-zinc-900">
              {isSignup ? "Create an account" : "Welcome back"}
            </h1>
            <p className="text-sm text-zinc-500">
              {isSignup
                ? "Sign up to start managing products and orders"
                : "Log in to continue"}
            </p>
          </div>

          {authError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
              {authError}
            </div>
          )}

          <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
            {isSignup && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700">
                  Name
                </label>
                <Input
                  placeholder="Jane Doe"
                  {...register("name", {
                    required: isSignup ? "Name is required" : false,
                  })}
                />
                {errors.name && (
                  <p className="text-xs text-red-600">{errors.name.message}</p>
                )}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-700">Email</label>
              <Input
                placeholder="you@example.com"
                type="email"
                {...register("email", { required: "Email is required" })}
              />
              {errors.email && (
                <p className="text-xs text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-700">
                Password
              </label>
              <Input
                placeholder="••••••••"
                type="password"
                {...register("password", { required: "Password is required" })}
              />
              {errors.password && (
                <p className="text-xs text-red-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting
                ? "Please wait…"
                : isSignup
                  ? "Create account"
                  : "Log in"}
            </Button>
          </form>

          <div className="text-xs text-zinc-500">
            {isSignup ? "Already have an account?" : "New here?"}{" "}
            <button
              type="button"
              className="text-zinc-900 font-medium hover:underline"
              onClick={() => setIsSignup((v) => !v)}
            >
              {isSignup ? "Log in" : "Create one"}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
