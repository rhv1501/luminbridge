import React from "react";
import { cn } from "./cn";

export function Button({
  children,
  onClick,
  variant = "primary",
  className,
  type = "button",
  disabled = false,
  loading = false,
  title,
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: "primary" | "secondary" | "outline" | "danger";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  loading?: boolean;
  title?: string;
}) {
  const variants = {
    primary:
      "bg-zinc-900 text-white border-2 border-zinc-900 shadow-[4px_4px_0px_0px_rgba(24,24,27,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_rgba(24,24,27,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
    secondary:
      "bg-emerald-600 text-white border-2 border-emerald-800 shadow-[4px_4px_0px_0px_rgba(6,95,70,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_rgba(6,95,70,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
    outline:
      "bg-white border-2 border-zinc-900 text-zinc-900 shadow-[4px_4px_0px_0px_rgba(24,24,27,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_rgba(24,24,27,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
    danger:
      "bg-red-600 text-white border-2 border-red-800 shadow-[4px_4px_0px_0px_rgba(153,27,27,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_rgba(153,27,27,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
  };

  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      title={title}
      aria-busy={loading || undefined}
      className={cn(
        "px-4 py-2 rounded-lg font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:ring-offset-2 focus:ring-offset-zinc-50",
        variants[variant],
        className,
      )}
    >
      {loading && (
        <span className="inline-flex" aria-hidden="true">
          <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
        </span>
      )}
      {children}
    </button>
  );
}
