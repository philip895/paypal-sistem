import { NextResponse } from "next/server";
import { getCurrentStore } from "@/lib/store";
import { checkAndNotify } from "@/lib/scheduling/alerts";

/**
 * Pinged on a schedule by .github/workflows/schedule-check.yml (the free
 * hosting tier has no always-on worker to run this on its own). Also has
 * the side benefit of keeping the free Render instance from spinning down
 * during the hours it's called.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const store = await getCurrentStore();
  const result = await checkAndNotify(store.id, store.timezone);
  return NextResponse.json({ ok: true, ...result });
}
