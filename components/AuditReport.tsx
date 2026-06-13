"use client";

import { useState } from "react";
import { Button } from "./Button";
import { RiskScore } from "./RiskScore";
import { VulnerabilityCard } from "./VulnerabilityCard";
import type { AnalysisResult } from "@/lib/types";

export function AuditReport({ result }: { result: AnalysisResult }) {
  const [copied, setCopied] = useState(false);

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-4">
        <RiskScore score={result.riskScore} level={result.riskLevel} />
        <div className="flex-1 space-y-2 rounded-lg border border-gray-800 bg-surface p-4 text-sm text-gray-300">
          <p>
            <span className="font-semibold text-white">Contract: </span>
            {result.contractName}
          </p>
          <p>
            <span className="font-semibold text-white">Pragma: </span>
            {result.pragma ?? "n/a"}
          </p>
          <p>
            <span className="font-semibold text-white">Detectors run: </span>
            {result.detectorCount}
          </p>
          <p>
            <span className="font-semibold text-white">Analyzed at: </span>
            {result.analyzedAt}
          </p>
          <p className="pt-2 text-gray-200">{result.summary}</p>
          <div className="pt-2">
            <Button size="sm" variant="secondary" onClick={copyJson}>
              {copied ? "Copied" : "Copy as JSON"}
            </Button>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {result.vulnerabilities.length === 0 ? (
          <p className="rounded-lg border border-emerald-900/40 bg-emerald-950/30 p-4 text-sm text-emerald-200">
            No findings — this contract looks clean against the seven detectors.
          </p>
        ) : (
          result.vulnerabilities.map((v) => <VulnerabilityCard key={`${v.id}-${v.location?.line ?? "x"}`} finding={v} />)
        )}
      </div>
    </div>
  );
}
