"use client";

import { useState } from "react";
import { Button } from "./Button";

const CONFIG_JSON = JSON.stringify(
  {
    mcpServers: {
      "smart-contract-mcp": {
        url: "https://smart-contract-mcp.vercel.app/api/mcp",
      },
    },
  },
  null,
  2,
);

export function InstallInstructions() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(CONFIG_JSON);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-3">
      <pre className="overflow-x-auto rounded-lg border border-gray-800 bg-[#0a0f1c] p-4 text-sm text-gray-100">
        <code>{CONFIG_JSON}</code>
      </pre>
      <div>
        <Button size="sm" variant="secondary" onClick={copy}>
          {copied ? "Copied" : "Copy config"}
        </Button>
      </div>
    </div>
  );
}
