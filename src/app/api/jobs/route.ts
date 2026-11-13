import { listJobs } from "@/lib/stm/store";
import { createJob, extractUrls, kickWorker } from "@/lib/stm/worker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
    kickWorker();
    return Response.json({ jobs: listJobs() });
}

/**
 * Create jobs. Accepts JSON {url | urls | text, direct?, source?} or a plain-text body
 * (handy for the iOS shortcut: "Inhalte von URL abrufen" → POST → Kurzbefehleingabe).
 */
export async function POST(req: Request) {
    let text = "";
    let direct = false;
    let source = "shortcut";
    const contentType = req.headers.get("content-type") || "";
    try {
        if (contentType.includes("application/json")) {
            const body = await req.json();
            const parts: string[] = [];
            if (typeof body.url === "string") parts.push(body.url);
            if (Array.isArray(body.urls)) parts.push(...body.urls.map(String));
            if (typeof body.text === "string") parts.push(body.text);
            text = parts.join("\n");
            direct = Boolean(body.direct);
            if (typeof body.source === "string") source = body.source;
        } else if (contentType.includes("form")) {
            const form = await req.formData();
            text = [form.get("url"), form.get("text")].filter(Boolean).join("\n");
            direct = form.get("direct") === "true";
        } else {
            text = await req.text();
        }
    } catch {
        return Response.json({ error: "Anfrage konnte nicht gelesen werden" }, { status: 400 });
    }

    const urls = extractUrls(text);
    if (urls.length === 0) {
        return Response.json({ error: "Kein Link gefunden" }, { status: 400 });
    }
    const jobs = urls.slice(0, 20).map((url) => createJob(url, { source, direct }));
    return Response.json(
        { ok: true, message: `${jobs.length} Link(s) in der Warteschlange`, jobs: jobs.map((j) => j.id) },
        { status: 201 },
    );
}
