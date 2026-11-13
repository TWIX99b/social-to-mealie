import { env } from "@/lib/constants";

/** Push a message through Gotify (optional; GOTIFY_URL + GOTIFY_TOKEN). */
export async function notify(title: string, message: string, clickPath?: string) {
    if (!env.GOTIFY_URL || !env.GOTIFY_TOKEN) return;
    const clickUrl = clickPath?.startsWith("http") ? clickPath : env.APP_URL && clickPath ? `${env.APP_URL}${clickPath}` : undefined;
    try {
        await fetch(`${env.GOTIFY_URL}/message`, {
            method: "POST",
            headers: { "content-type": "application/json", "X-Gotify-Key": env.GOTIFY_TOKEN },
            signal: AbortSignal.timeout(10_000),
            body: JSON.stringify({
                title,
                message,
                priority: 5,
                extras: clickUrl ? { "client::notification": { click: { url: clickUrl } } } : undefined,
            }),
        });
    } catch (e) {
        console.warn("Gotify notification failed", e);
    }
}
