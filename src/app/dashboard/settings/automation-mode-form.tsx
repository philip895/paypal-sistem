"use client";

import { useTransition } from "react";
import { updateAutomationModeAction } from "./actions";

export function AutomationModeForm({ current }: { current: string }) {
  const [pending, startTransition] = useTransition();

  function handleChange(mode: string) {
    if (mode === "LIVE") {
      const ok = window.confirm(
        "Passare a LIVE significa che il sistema tratterà i passaggi risolti come decisioni di instradamento reali. " +
          "Con il piano attuale di questo account non esiste una connessione Payments App live, quindi questo cambia solo " +
          "quanto seriamente vengono trattati i passaggi in ritardo — NON rende automatico l'instradamento del checkout Shopify. " +
          "Continuare?"
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
