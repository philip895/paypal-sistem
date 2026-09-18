import { DateTime } from "luxon";
import { getCurrentStore } from "@/lib/store";
import { prisma } from "@/lib/db";

export default async function NotificationsPage() {
  const store = await getCurrentStore();
  const notifications = await prisma.notification.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
      <p className="text-sm text-slate-500">
        Delivery channels (email/Slack/webhook) are configured in Settings. Until a channel is wired up,
        events are recorded here but not delivered — see the README&rsquo;s Notifications section.
      </p>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Time</th>
              <th className="px-4 py-2">Channel</th>
              <th className="px-4 py-2">Event</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {notifications.map((n) => (
              <tr key={n.id}>
                <td className="px-4 py-2 text-xs text-slate-500">
                  {DateTime.fromJSDate(n.createdAt).setZone(store.timezone).toFormat("yyyy-LL-dd HH:mm:ss")}
                </td>
                <td className="px-4 py-2 text-xs">{n.channel}</td>
                <td className="px-4 py-2 text-xs">{n.eventType}</td>
                <td className="px-4 py-2 text-xs">{n.deliveryStatus}</td>
              </tr>
            ))}
            {notifications.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-center text-slate-400">
                  No notifications yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
