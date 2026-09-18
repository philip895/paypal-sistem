import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { logoutAction } from "./actions";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/configurations", label: "Configurazioni di pagamento" },
  { href: "/dashboard/schedule", label: "Programmazione" },
  { href: "/dashboard/calendar", label: "Calendario" },
  { href: "/dashboard/overrides", label: "Eccezioni" },
  { href: "/dashboard/activity", label: "Attività" },
  { href: "/dashboard/errors", label: "Errori" },
  { href: "/dashboard/notifications", label: "Notifiche" },
  { href: "/dashboard/settings", label: "Impostazioni" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4">
          <p className="text-sm font-semibold text-slate-900">Console di Instradamento PayPal</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {session.email} &middot; <span className="font-medium">{session.role}</span>
          </p>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <form action={logoutAction} className="border-t border-slate-200 p-2">
          <button
            type="submit"
            className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-100"
          >
            Esci
          </button>
        </form>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
