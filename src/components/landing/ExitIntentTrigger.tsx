import { lazy, Suspense } from "react";
import { useExitIntent } from "@/hooks/useExitIntent";

const ExitIntentPopup = lazy(() => import("@/components/ExitIntentPopup"));

interface ExitIntentTriggerProps {
  companyId?: string;
  brand: "credit" | "finance" | "capital";
  variant?: "discount" | "consultation" | "emi-calculator";
  /** Disable when another modal is open. */
  disabled?: boolean;
}

const ExitIntentTrigger = ({ companyId, brand, variant = "discount", disabled }: ExitIntentTriggerProps) => {
  const { shouldShow, dismiss } = useExitIntent({
    enabled: !disabled,
    storageKey: brand,
  });

  if (!shouldShow) return null;

  return (
    <Suspense fallback={null}>
      <ExitIntentPopup companyId={companyId} variant={variant} onClose={dismiss} />
    </Suspense>
  );
};

export default ExitIntentTrigger;
