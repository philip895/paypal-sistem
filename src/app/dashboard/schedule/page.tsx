import { getCurrentStore } from "@/lib/store";
import { prisma } from "@/lib/db";
import { RecurringRuleForm } from "./rule-form";
import { deleteRecurringRuleAction } from "./actions";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function SchedulePage() {
  const store = await getCurrentStore();
  const [rules, configs] = await Promise.all([
    prisma.recurringRule.findMany({
      where: { storeId: store.id },
      include: { config: true },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    prisma.paymentConfiguration.findMany({ where: { storeId: store.id } }),
  ]);

  const byDay = DAYS.map((_, dayOfWeek) => rules.filter((r) => r.dayOfWeek === dayOfWeek));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Recurring Schedule</h1>
      <p className="text-sm text-slate-500">
        Times are wall-clock in {store.timezone}. New rules are checked against existing ones on the same
        day and rejected on overlap.
      </p>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm font-medium text-slate-900">Add recurring rule</p>
        <RecurringRuleForm configs={configs} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {DAYS.map((day, dayOfWeek) => (
          <div key={day} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">{day}</p>
            {byDay[dayOfWeek].length === 0 ? (
              <p className="mt-2 text-xs text-slate-400">No rules</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {byDay[dayOfWeek].map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-sm">
                    <span>
                      {r.startTime}–{r.endTime} → {r.config.internalName}
                      {!r.active && <span className="ml-2 text-xs text-slate-400">(inactive)</span>}
                    </span>
                    <form action={deleteRecurringRuleAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="text-xs text-red-600 hover:underline">Remove</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
