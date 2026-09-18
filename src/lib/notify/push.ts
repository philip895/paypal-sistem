/**
 * ntfy.sh push notifications — free, no account required. Whoever has
 * subscribed to NTFY_TOPIC in the ntfy app (iOS/Android/web) gets a phone
 * notification. Topic names are effectively a shared secret (anyone who
 * knows it can publish/subscribe), so it should stay unguessable.
 */
export async function sendAlertPush(title: string, message: string, urgent = false): Promise<boolean> {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return false;

  try {
    const res = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: "POST",
      body: message,
      headers: {
        Title: title,
        Priority: urgent ? "urgent" : "default",
        Tags: urgent ? "rotating_light" : "bell",
      },
    });
    return res.ok;
  } catch (err) {
    console.error("Failed to send push notification:", err);
    return false;
  }
}
