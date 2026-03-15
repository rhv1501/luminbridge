import React from "react";
import { cn } from "./cn";

export function Card({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  key?: React.Key;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className={cn(
        "bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden",
        className,
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
