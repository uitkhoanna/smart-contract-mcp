import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart Contract Security Analyzer — MCP",
  description:
    "A production-ready MCP server that audits Solidity contracts for the seven most common vulnerability classes (SWC-101, -104, -105, -106, -107, -115, -116).",
  openGraph: {
    title: "Smart Contract Security Analyzer — MCP",
    description:
      "Audit any Solidity contract for SWC-101/104/105/106/107/115/116 directly from Claude Desktop.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-gray-200 antialiased">
        <header className="border-b border-gray-800 bg-surface/50 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <a href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
              <span>smart-contract-mcp</span>
            </a>
            <nav className="flex items-center gap-6 text-sm text-gray-300">
              <a href="/#features" className="hover:text-white">Features</a>
              <a href="/#install" className="hover:text-white">Install</a>
              <a href="/demo" className="rounded-md bg-accent px-3 py-1.5 font-medium text-white hover:bg-accent-600">Try the demo</a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        <footer className="mx-auto max-w-6xl px-6 py-10 text-xs text-gray-500">
          Static analysis only — not a substitute for a human audit. Powered by{" "}
          <a className="underline hover:text-gray-300" href="https://swcregistry.io">SWC Registry</a>.
        </footer>
      </body>
    </html>
  );
}
