import type { RiskLevel, Severity, Vulnerability } from "./types";

interface SeverityCap {
  weight: number;
  cap: number;
}

const SEVERITY_CAPS: Record<Severity, SeverityCap> = {
  critical: { weight: 25, cap: 50 },
  high: { weight: 15, cap: 30 },
  medium: { weight: 10, cap: 20 },
  low: { weight: 5, cap: 10 },
  info: { weight: 0, cap: 0 },
};

/**
 * Aggregate the severities of the findings into a single 0-100 risk score.
 * The cap table in the brief is:
 *   critical → +25 each, capped at 50 in total
 *   high     → +15 each, capped at 30 in total
 *   medium   → +10 each, capped at 20 in total
 *   low      → +5  each, capped at 10 in total
 *   info     → contributes nothing
 */
export function calculateRiskScore(vulnerabilities: Vulnerability[]): number {
  const contributions: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const v of vulnerabilities) {
    const cap = SEVERITY_CAPS[v.severity];
    if (cap.weight === 0) continue;
    contributions[v.severity] += cap.weight;
  }
  const total =
    Math.min(contributions.critical, SEVERITY_CAPS.critical.cap) +
    Math.min(contributions.high, SEVERITY_CAPS.high.cap) +
    Math.min(contributions.medium, SEVERITY_CAPS.medium.cap) +
    Math.min(contributions.low, SEVERITY_CAPS.low.cap);
  return Math.max(0, Math.min(100, Math.round(total)));
}

export function riskLevel(score: number): RiskLevel {
  if (score >= 76) return "critical";
  if (score >= 51) return "high";
  if (score >= 26) return "medium";
  return "low";
}
