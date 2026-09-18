"use client";

import { useActionState } from "react";
import { createScheduleOverrideAction } from "./actions";

export function ScheduleOverrideForm({ configs }: { configs: { id: string; internalName: string }[] }) {
  const [state, formAction, pending] = useActionState(createScheduleOverrideAction, undefined);

  return (
    <form action={formAction} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-5">
      <select name="configId" required className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
        {configs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.internalName}
          </option>
        ))}
      </select>
      <input type="datetime-local" name="startAt" required className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
      <input type="datetime-local" name="endAt" required className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
      <input name="reason" placeholder="Reason (optional)" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
      <button
        disabled={pending}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {pending ? "Checking conflicts..." : "Add override"}
      </button>
      {state?.error && <p className="col-span-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
