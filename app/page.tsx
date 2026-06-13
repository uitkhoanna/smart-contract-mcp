import { InstallInstructions } from "@/components/InstallInstructions";

const FEATURES = [
  {
    title: "7 AST-based detectors",
    body: "Pure-TypeScript visitor over the @solidity-parser/parser AST. No Python, no subprocess, no slither on Vercel — just a single function call per detector.",
  },
  {
    title: "MCP-native",
    body: "Four tools exposed via Vercel's mcp-handler: analyze_contract, check_vulnerability, generate_audit_report, and suggest_fix. Drop into Claude Desktop with a 6-line JSON.",
  },
  {
    title: "Production-grade",
    body: "Strict TypeScript, zod-validated request bodies, stable scoring, and a markdown audit-report generator ready to paste into a PR description.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-20">
      <section className="pt-6">
        <p className="text-sm uppercase tracking-widest text-accent-300">MCP server · Solidity</p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
          Audit any Solidity contract in&nbsp;
          <span className="text-accent">Claude Desktop</span>.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-gray-400">
          A production MCP server that statically analyzes Solidity for the seven classes
          of vulnerability most likely to drain your contract — reentrancy, access control,
          integer overflow, unchecked low-level calls, timestamp dependence, tx.origin
          authorization, and unprotected selfdestruct.
        </p>
        <div className="mt-6 flex gap-3">
          <a
            href="/demo"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-600"
          >
            Open the playground
          </a>
          <a
            href="#install"
            className="rounded-md border border-gray-700 px-4 py-2 text-sm font-medium text-gray-200 hover:border-accent"
          >
            Install in Claude Desktop
          </a>
        </div>
      </section>

      <section id="features" className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-lg border border-gray-800 bg-surface p-6"
          >
            <h3 className="text-base font-semibold text-white">{f.title}</h3>
            <p className="mt-2 text-sm text-gray-400">{f.body}</p>
          </div>
        ))}
      </section>

      <section id="install" className="space-y-4">
        <h2 className="text-2xl font-semibold">Install in Claude Desktop</h2>
        <p className="text-gray-400">
          Add the following to <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>{" "}
          (or the equivalent on Windows / Linux) and restart Claude.
        </p>
        <InstallInstructions />
      </section>

      <section id="vulns" className="space-y-3">
        <h2 className="text-2xl font-semibold">Vulnerability coverage</h2>
        <p className="text-gray-400">Seven detectors, one per SWC entry — see the README for the full table.</p>
      </section>
    </div>
  );
}
