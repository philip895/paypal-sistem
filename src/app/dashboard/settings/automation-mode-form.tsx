"use client";

import { useTransition } from "react";
import { updateAutomationModeAction } from "./actions";

export function AutomationModeForm({ current }: { current: string }) {
  const [pending, startTransition] = useTransition();

  function handleChange(mode: string) {
    if (mode === "LIVE") {
      const ok = window.confirm(
        "Switching to LIVE means the system will treat resolved switches as real routing decisions. " +
          "On this account's current plan there is no live Payments App connection, so this only changes " +
          "how seriously overdue switches are treated — it does NOT make Shopify checkout routing automatic. " +
          "Continue?"
      );
      if (!ok) return;
    }
    const formData = new FormData();
    formData.set("automationMode", mode);
    startTransition(() => updateAutomationModeAction(formData));
  }

  return (
    <div className="flex gap-2">
      {["SIMULATION", "LIVE"].map((mode) => (
        <button
          key={mode}
          disabled={pending}
          onClick={() => handleChange(mode)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
            current === mode ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          {mode}
        </button>
      ))}
    </div>
  );
}
