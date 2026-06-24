import { RiskProvider } from "@/components/risk-context";
import { RiskApp } from "@/components/RiskApp";

export default function Page() {
  return (
    <RiskProvider>
      <RiskApp />
    </RiskProvider>
  );
}
