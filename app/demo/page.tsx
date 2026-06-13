import { DemoClient } from "@/components/DemoClient";
import { VULNERABLE_BANK_SOURCE } from "@/lib/sample";

export const metadata = {
  title: "Demo — Smart Contract Security Analyzer",
};

export default function DemoPage() {
  return <DemoClient initialSource={VULNERABLE_BANK_SOURCE} />;
}
