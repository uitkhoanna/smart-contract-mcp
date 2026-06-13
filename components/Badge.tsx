import type { ReactNode } from "react";
import { clsx } from "clsx";
import type { Severity } from "@/lib/types";

const SEVERITY_CLASSES: Record<Severity, string> = {
  critical: "bg-red-950 text-red-300 border-red-800",
  high: "bg-orange-950 text-orange-300 border-orange-800",
  medium: "bg-yellow-950 text-yellow-300 border-yellow-800",
  low: "bg-sky-950 text-sky-300 border-sky-800",
  info: "bg-gray-800 text-gray-300 border-gray-700",
};

export function Badge({
  severity,
  children,
}: {
  severity: Severity;
  children: ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium uppercase tracking-wide",
        SEVERITY_CLASSES[severity],
      )}
    >
      {children}
    </span>
  );
}
