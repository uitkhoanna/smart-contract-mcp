"use client";

import { useState, type ChangeEvent } from "react";
import { Button } from "./Button";
import { clsx } from "clsx";

interface ContractInputProps {
  defaultValue: string;
  onAnalyze: (source: string) => void;
  isLoading: boolean;
}

export function ContractInput({ defaultValue, onAnalyze, isLoading }: ContractInputProps) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="flex h-full flex-col rounded-lg border border-gray-800 bg-surface">
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2">
        <span className="text-xs uppercase tracking-widest text-gray-400">contract.sol</span>
        <Button
          onClick={() => onAnalyze(value)}
          disabled={isLoading || value.trim().length === 0}
          size="sm"
        >
          {isLoading ? "Analyzing..." : "Analyze"}
        </Button>
      </div>
      <textarea
        spellCheck={false}
        className={clsx(
          "h-full min-h-[24rem] flex-1 resize-none rounded-b-lg bg-[#0a0f1c] p-4 font-mono text-sm text-gray-100 outline-none",
          "focus:ring-2 focus:ring-accent-500/40",
        )}
        value={value}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setValue(e.target.value)}
      />
    </div>
  );
}
