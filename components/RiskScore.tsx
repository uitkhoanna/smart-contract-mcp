import type { RiskLevel } from "@/lib/types";
import { clsx } from "clsx";

const LEVEL_COLOR: Record<RiskLevel, string> = {
  low: "text-emerald-400 stroke-emerald-400",
  medium: "text-yellow-400 stroke-yellow-400",
  high: "text-orange-400 stroke-orange-400",
  critical: "text-red-400 stroke-red-400",
};

export function RiskScore({ score, level }: { score: number; level: RiskLevel }) {
  const resolvedLevel = level ?? "low";
  const size = 120;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100);
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-gray-800 bg-surface p-4">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(31, 41, 55)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={clsx("transition-all", LEVEL_COLOR[resolvedLevel])}
        />
      </svg>
      <div className="text-center">
        <div className="text-2xl font-semibold text-white">{score}/100</div>
        <div className={clsx("text-xs uppercase tracking-widest", LEVEL_COLOR[resolvedLevel])}>
          {resolvedLevel}
        </div>
      </div>
    </div>
  );
}
