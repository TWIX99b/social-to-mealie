import { getSettings, saveSettings } from "@/lib/stm/store";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/stm/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
    return Response.json({ settings: getSettings() });
}

export async function PUT(req: Request) {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return Response.json({ error: "Ungültig" }, { status: 400 });
    const current = getSettings();
    const rules = { ...current.rules };
    for (const key of Object.keys(DEFAULT_SETTINGS.rules) as (keyof Settings["rules"])[]) {
        if (typeof body.rules?.[key] === "boolean") rules[key] = body.rules[key];
    }
    const next: Settings = {
        rules,
        freeText: typeof body.freeText === "string" ? body.freeText.slice(0, 4000) : current.freeText,
        model: ["auto", "fast", "smart"].includes(body.model) ? body.model : current.model,
    };
    saveSettings(next);
    return Response.json({ settings: next });
}
