"use client";

import { useActionState } from "react";
import { createRecurringRuleAction } from "./actions";

const DAYS = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

export function RecurringRuleForm({ configs }: { configs: { id: string; internalName: string }[] }) {
  const [state, formAction, pending] = useActionState(createRecurringRuleAction, undefined);

  return (
    <form action={formAction} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-5">
      <select name="dayOfWeek" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" required>
        {DAYS.map((day, i) => (
          <option key={day} value={i}>
            {day}
          </option>
        ))}
      </select>
      <input type="time" name="startTime" required className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
      <input type="time" name="endTime" required className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
      <select name="configId" required className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
        {configs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.internalName}
          </option>
        ))}
      </select>
      <button
        disabled={pending}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {pending ? "Verifica conflitti..." : "Aggiungi regola"}
      </button>
      {state?.error && <p className="col-span-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
