"use client";

import { useState } from "react";
import { ContractInput } from "./ContractInput";
import { AuditReport } from "./AuditReport";
import type { AnalysisResult } from "@/lib/types";

interface DemoClientProps {
  initialSource: string;
}

interface ApiError {
  error: string;
  message?: string;
  issues?: unknown;
}

export function DemoClient({ initialSource }: DemoClientProps) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function run(source: string) {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source_code: source, contract_name: "VulnerableBank" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as ApiError;
        setError(body.message ?? body.error ?? `HTTP ${res.status}`);
        return;
      }
      const body = (await res.json()) as AnalysisResult;
      setResult(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid h-[calc(100vh-12rem)] grid-cols-1 gap-4 lg:grid-cols-2">
      <ContractInput defaultValue={initialSource} onAnalyze={run} isLoading={isLoading} />
      <section className="overflow-y-auto rounded-lg border border-gray-800 bg-surface/40 p-4">
        {error ? (
          <p className="rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>
        ) : result ? (
          <AuditReport result={result} />
        ) : (
          <p className="text-sm text-gray-400">
            Click <span className="text-white">Analyze</span> to run the seven detectors against the contract on
            the left.
          </p>
        )}
      </section>
    </div>
  );
}
