import { getSession } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store";
import { prisma } from "@/lib/db";
import { updateSafeDefaultAction } from "./actions";
import { AutomationModeForm } from "./automation-mode-form";
import { CreateUserForm } from "./user-form";

export default async function SettingsPage() {
  const session = await getSession();
  const store = await getCurrentStore();
  const configs = await prisma.paymentConfiguration.findMany({ where: { storeId: store.id } });
  const users = session?.role === "OWNER" ? await prisma.user.findMany({ orderBy: { createdAt: "asc" } }) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm font-medium text-slate-900">Automation mode</p>
        <p className="mt-1 text-xs text-slate-500">
          Requires OWNER. See the architecture doc&rsquo;s Decision Gate — real live routing needs Shopify
          Plus and an approved Payments App, which this account doesn&rsquo;t have yet.
        </p>
        <div className="mt-3">
          <AutomationModeForm current={store.automationMode} />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm font-medium text-slate-900">Safe default configuration</p>
        <p className="mt-1 text-xs text-slate-500">
          Used whenever no manual override, one-time override, or recurring rule covers the current time.
        </p>
        <form action={updateSafeDefaultAction} className="mt-3 flex items-center gap-2">
          <select name="safeDefaultConfigId" defaultValue={store.safeDefaultConfigId ?? ""} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">None</option>
            {configs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.internalName}
              </option>
            ))}
          </select>
          <button className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
            Save
          </button>
        </form>
      </div>

      {session?.role === "OWNER" && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-900">Users</p>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {users.map((u) => (
              <li key={u.id} className="flex items-center justify-between py-2">
                <span>{u.email}</span>
                <span className="text-xs font-medium text-slate-500">{u.role}</span>
              </li>
            ))}
          </ul>
          <CreateUserForm />
        </div>
      )}
    </div>
  );
}
