import { env } from "@/lib/constants";
import { cookieStatus } from "@/lib/stm/cookies";
import { getCategories, getTags } from "@/lib/stm/mealie-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Tags and categories from Mealie plus a few facts for the settings page. */
export async function GET() {
    const [tags, categories] = await Promise.all([
        getTags().then((t) => t.map((x) => x.name)).catch(() => [] as string[]),
        getCategories().then((c) => c.map((x) => x.name)).catch(() => [] as string[]),
    ]);
    return Response.json({
        tags: tags.sort((a, b) => a.localeCompare(b, "de")),
        categories: categories.sort((a, b) => a.localeCompare(b, "de")),
        info: {
            gotify: Boolean(env.GOTIFY_URL && env.GOTIFY_TOKEN),
            gotifyUrl: env.GOTIFY_URL,
            claude: Boolean(env.ANTHROPIC_API_KEY),
            fastModel: env.CLAUDE_MODEL_FAST,
            smartModel: env.CLAUDE_MODEL_SMART,
            localWhisper: env.LOCAL_TRANSCRIPTION_MODEL || "",
            mealieUrl: env.EXTERNAL_MEALIE_URL || env.MEALIE_URL,
            appUrl: env.APP_URL,
            retentionDays: env.RETENTION_DAYS,
            cookies: cookieStatus(),
        },
    });
}
