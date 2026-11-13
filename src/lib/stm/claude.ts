import fs from "fs";
import { env } from "@/lib/constants";
import { parsePartialJson } from "./partial-json";
import { st } from "./store";
import type { DraftRecipe, Ingredient, Settings } from "./types";

const RECIPE_TOOL_SCHEMA = {
    type: "object",
    properties: {
        name: { type: "string", description: "Recipe title" },
        description: { type: "string", description: "1–2 sentences, appetising and factual" },
        servings: { type: ["integer", "null"], description: "Number of servings" },
        totalTime: { type: ["string", "null"], description: "Total time" },
        prepTime: { type: ["string", "null"], description: "Hands-on time" },
        ingredients: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    quantity: { type: ["number", "null"], description: "Amount as a number (½ → 0.5); null without amount" },
                    unit: { type: ["string", "null"], description: "Unit from the unit list, or null (null for counted items)" },
                    food: { type: "string", description: "Food as the singular base word" },
                    note: { type: ["string", "null"], description: "Extra such as chopped, red, for frying" },
                },
                required: ["quantity", "unit", "food", "note"],
            },
        },
        instructions: { type: "array", items: { type: "string" }, description: "Steps, one clear paragraph each" },
        tags: { type: "array", items: { type: "string" } },
        category: { type: ["string", "null"] },
        notes: {
            type: "array",
            items: {
                type: "object",
                properties: { title: { type: "string" }, text: { type: "string" } },
                required: ["title", "text"],
            },
            description: "Tips or variations from the video, otherwise empty",
        },
    },
    required: ["name", "description", "servings", "totalTime", "prepTime", "ingredients", "instructions", "tags", "category", "notes"],
};

export interface ClaudeContext {
    url: string;
    title?: string;
    description?: string;
    transcript?: string;
    imageFiles: string[];
    settings: Settings;
    units: string[];
    tags: string[];
    categories: string[];
    hint?: string;
    previous?: DraftRecipe;
    model: string;
}

function systemPrompt(ctx: ClaudeContext): string {
    const r = ctx.settings.rules;
    const de = ctx.settings.language === "de";
    const language = de ? "German" : "English";
    const rules: string[] = [
        "You are an experienced cook and recipe editor. From a social media post (description, images, video transcript) you write a clean recipe that can be cooked from.",
        "Do not invent ingredients or amounts that are not in the material; only estimate when it is obvious, and mark estimates in the note (\"" + (de ? "ca." : "approx.") + "\").",
        "List ingredients in the order they are used. The food is the plain base word (e.g. \"" + (de ? "Zwiebel" : "onion") + "\"); preparation like chopped or diced goes into the note.",
        "For counted items (2 onions, 1 lime) the unit stays null.",
        r.translate
            ? `Write everything (title, description, ingredients, steps, notes) in ${language}, translating if the post is in another language.`
            : `Write in ${language} unless the post is clearly in another language; then keep the post's language.`,
        `Times use the format ${de ? '"30 Min" or "1 Std 20 Min"' : '"30 min" or "1 h 20 min"'}.`,
    ];
    if (r.metric) rules.push("Use metric units (g, kg, ml, l) and °C; convert cups, ounces and Fahrenheit.");
    if (r.spoons) rules.push(de ? "Spoon measures as EL and TL, never tbsp/tsp." : "Spoon measures as tbsp and tsp.");
    if (r.oven) {
        rules.push(
            de
                ? "If an oven is used, name the mode (Ober-/Unterhitze or Umluft) with the temperature."
                : "If an oven is used, name the mode (conventional or fan) with the temperature.",
        );
    }
    if (r.existingTags) {
        rules.push("Pick tags and the category ONLY from the existing lists; never invent new ones. If nothing fits, use an empty list or null.");
    } else {
        rules.push("Prefer tags from the existing list; only add new ones when really needed.");
    }
    if (ctx.settings.freeText.trim()) rules.push(`The user's own rules: ${ctx.settings.freeText.trim()}`);
    rules.push(`Units known in Mealie: ${ctx.units.join(", ") || "(none)"}. Use these spellings.`);
    rules.push(`Existing tags: ${ctx.tags.join(", ") || "(none)"}.`);
    rules.push(`Existing categories: ${ctx.categories.join(", ") || "(none)"}.`);
    rules.push("Return the result only through the save_recipe tool.");
    return rules.join("\n");
}

function userText(ctx: ClaudeContext): string {
    const parts = [
        `<source>${ctx.url}</source>`,
        ctx.title ? `<title>${ctx.title}</title>` : "",
        `<description>\n${ctx.description || "(no description)"}\n</description>`,
        `<transcript>\n${ctx.transcript?.trim() || "(no speech in the video)"}\n</transcript>`,
    ];
    if (ctx.previous) {
        parts.push(`<previous_draft>\n${JSON.stringify(ctx.previous)}\n</previous_draft>`);
        parts.push(
            ctx.hint?.trim()
                ? `Revise the previous draft. The user's hint: ${ctx.hint.trim()}`
                : "Write the recipe again, more carefully and completely.",
        );
    } else {
        parts.push("Create the recipe from this.");
    }
    return parts.filter(Boolean).join("\n\n");
}

function normalize(raw: any): DraftRecipe {
    const r = raw && typeof raw === "object" ? raw : {};
    const ingredients: Ingredient[] = Array.isArray(r.ingredients)
        ? r.ingredients
              .filter((i: any) => i && typeof i === "object")
              .map((i: any) => ({
                  quantity: typeof i.quantity === "number" ? i.quantity : i.quantity ? Number(String(i.quantity).replace(",", ".")) || null : null,
                  unit: i.unit ? String(i.unit) : null,
                  food: i.food ? String(i.food) : "",
                  note: i.note ? String(i.note) : null,
              }))
        : [];
    return {
        name: typeof r.name === "string" ? r.name : "",
        description: typeof r.description === "string" ? r.description : "",
        servings: typeof r.servings === "number" ? r.servings : null,
        totalTime: r.totalTime ? String(r.totalTime) : null,
        prepTime: r.prepTime ? String(r.prepTime) : null,
        ingredients,
        instructions: Array.isArray(r.instructions) ? r.instructions.map((x: any) => String(x?.text ?? x)) : [],
        notes: Array.isArray(r.notes)
            ? r.notes.filter((n: any) => n && n.text).map((n: any) => ({ title: String(n.title || ""), text: String(n.text) }))
            : [],
        tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
        category: r.category ? String(r.category) : null,
    };
}

function imageBlocks(files: string[]) {
    const blocks = [];
    for (const f of files.slice(0, 8)) {
        try {
            const data = fs.readFileSync(f).toString("base64");
            blocks.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
        } catch {
            /* skip */
        }
    }
    return blocks;
}

/**
 * Streams the recipe from Claude. onPartial receives the recipe as far as it is written.
 */
export async function writeRecipeWithClaude(
    ctx: ClaudeContext,
    onPartial: (partial: Partial<DraftRecipe>) => void,
): Promise<DraftRecipe> {
    if (!env.ANTHROPIC_API_KEY) throw new Error(st("srv.claudeNoKey"));

    const res = await fetch(`${env.ANTHROPIC_URL}/v1/messages`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-api-key": env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
        },
        signal: AbortSignal.timeout(300_000),
        body: JSON.stringify({
            model: ctx.model,
            max_tokens: 8192,
            stream: true,
            system: systemPrompt(ctx),
            tools: [{ name: "save_recipe", description: "Saves the finished recipe.", input_schema: RECIPE_TOOL_SCHEMA }],
            tool_choice: { type: "tool", name: "save_recipe" },
            messages: [{ role: "user", content: [...imageBlocks(ctx.imageFiles), { type: "text", text: userText(ctx) }] }],
        }),
    });

    if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        if (res.status === 401) throw new Error(st("srv.claudeAuth"));
        if (res.status === 400 && /credit|balance/i.test(text)) throw new Error(st("srv.claudeCredit"));
        if (res.status === 404) throw new Error(st("srv.claudeModel", { model: ctx.model }));
        if (res.status === 429 || res.status === 529) throw new Error(st("srv.claudeBusy"));
        throw new Error(st("srv.claudeError", { code: res.status, msg: text.slice(0, 300) }));
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let json = "";
    let lastEmit = 0;
    let stopReason = "";

    const emitPartial = (force = false) => {
        const now = Date.now();
        if (!force && now - lastEmit < 120) return;
        lastEmit = now;
        const parsed = parsePartialJson(json);
        if (parsed && typeof parsed === "object") onPartial(parsed);
    };

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const chunk = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"));
            if (!dataLine) continue;
            let evt: any;
            try {
                evt = JSON.parse(dataLine.slice(5).trim());
            } catch {
                continue;
            }
            if (evt.type === "content_block_delta" && evt.delta?.type === "input_json_delta") {
                json += evt.delta.partial_json || "";
                emitPartial();
            } else if (evt.type === "message_delta" && evt.delta?.stop_reason) {
                stopReason = evt.delta.stop_reason;
            } else if (evt.type === "error") {
                throw new Error(st("srv.claudeError", { code: "", msg: evt.error?.message || "?" }));
            }
        }
    }
    emitPartial(true);

    let final: any;
    try {
        final = JSON.parse(json);
    } catch {
        final = parsePartialJson(json);
    }
    if (!final) throw new Error(st("srv.claudeNothing", { reason: stopReason || "?" }));
    const recipe = normalize(final);
    if (!recipe.name && recipe.ingredients.length === 0) {
        throw new Error(st("srv.claudeNoRecipe"));
    }
    return recipe;
}
