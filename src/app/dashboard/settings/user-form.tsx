"use client";

import { useActionState } from "react";
import { createUserAction } from "./actions";

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, undefined);

  return (
    <form action={formAction} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
      <input name="email" type="email" placeholder="Email" required className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
      <input name="password" type="password" placeholder="Password temporanea" required minLength={8} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
      <select name="role" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
        <option value="VIEWER">VIEWER</option>
        <option value="ADMIN">ADMIN</option>
        <option value="OWNER">OWNER</option>
      </select>
      <button disabled={pending} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
        {pending ? "Creazione in corso..." : "Crea utente"}
      </button>
      {state?.error && <p className="col-span-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
