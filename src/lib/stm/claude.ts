import fs from "fs";
import { env } from "@/lib/constants";
import { parsePartialJson } from "./partial-json";
import type { DraftRecipe, Ingredient, Settings } from "./types";

const RECIPE_TOOL_SCHEMA = {
    type: "object",
    properties: {
        name: { type: "string", description: "Rezepttitel" },
        description: { type: "string", description: "1–2 Sätze, appetitlich und sachlich" },
        servings: { type: ["integer", "null"], description: "Anzahl Portionen" },
        totalTime: { type: ["string", "null"], description: 'Gesamtzeit, Format "30 Min" oder "1 Std 20 Min"' },
        prepTime: { type: ["string", "null"], description: 'Arbeitszeit, gleiches Format' },
        ingredients: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    quantity: { type: ["number", "null"], description: "Menge als Zahl (0,5 → 0.5); null wenn ohne Menge" },
                    unit: { type: ["string", "null"], description: "Einheit aus der Einheitenliste oder null (bei Stückzahlen null)" },
                    food: { type: "string", description: "Lebensmittel im Singular-Grundwort, z. B. Zwiebel, Knoblauch, Kokosmilch" },
                    note: { type: ["string", "null"], description: "Zusatz wie gehackt, rot, zum Anbraten, ca. 1 kg" },
                },
                required: ["quantity", "unit", "food", "note"],
            },
        },
        instructions: { type: "array", items: { type: "string" }, description: "Arbeitsschritte, je Schritt ein klarer Absatz" },
        tags: { type: "array", items: { type: "string" } },
        category: { type: ["string", "null"] },
        notes: {
            type: "array",
            items: {
                type: "object",
                properties: { title: { type: "string" }, text: { type: "string" } },
                required: ["title", "text"],
            },
            description: "Tipps oder Varianten aus dem Video, sonst leer",
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
    const rules: string[] = [
        "Du bist ein erfahrener Koch und Rezeptredakteur. Aus Social-Media-Posts (Beschreibung, Bilder, Video-Transkript) machst du ein sauberes, nachkochbares Rezept.",
        "Erfinde keine Zutaten oder Mengen, die nicht aus dem Material hervorgehen; schätze nur, wenn es offensichtlich ist, und kennzeichne Schätzungen in der Notiz mit „ca.“.",
        "Zutaten in der Reihenfolge der Verwendung. Lebensmittel als Grundwort (z. B. „Zwiebel“, nicht „Zwiebeln, gewürfelt“ – das gehört in die Notiz).",
        "Bei Stückzahlen (2 Zwiebeln, 1 Limette) bleibt die Einheit null.",
    ];
    if (r.german) rules.push("Schreibe alles auf Deutsch (Titel, Beschreibung, Zutaten, Schritte, Notizen).");
    if (r.metric) rules.push("Nutze metrische Einheiten (g, kg, ml, l) und °C; rechne Cups, Unzen und Fahrenheit um.");
    if (r.spoons) rules.push("Löffelmaße als EL und TL, nie tbsp/tsp.");
    if (r.oven) rules.push("Kommt ein Ofen vor, nenne die Ofenart (Ober-/Unterhitze oder Umluft) mit Temperatur.");
    if (r.existingTags) {
        rules.push("Tags und Kategorie NUR aus den vorhandenen Listen wählen; nichts Neues erfinden. Passt nichts, leere Liste bzw. null.");
    } else {
        rules.push("Tags bevorzugt aus der vorhandenen Liste; neue nur wenn wirklich nötig.");
    }
    if (ctx.settings.freeText.trim()) rules.push(`Eigene Regeln des Nutzers: ${ctx.settings.freeText.trim()}`);
    rules.push(`Bekannte Einheiten in Mealie: ${ctx.units.join(", ") || "(keine)"}. Nutze diese Schreibweisen (z. B. „g“, „ml“, „EL“, „TL“, „Prise“, „Zehe“).`);
    rules.push(`Vorhandene Tags: ${ctx.tags.join(", ") || "(keine)"}.`);
    rules.push(`Vorhandene Kategorien: ${ctx.categories.join(", ") || "(keine)"}.`);
    rules.push("Gib das Ergebnis ausschließlich über das Werkzeug save_recipe zurück.");
    return rules.join("\n");
}

function userText(ctx: ClaudeContext): string {
    const parts = [
        `<quelle>${ctx.url}</quelle>`,
        ctx.title ? `<titel>${ctx.title}</titel>` : "",
        `<beschreibung>\n${ctx.description || "(keine Beschreibung)"}\n</beschreibung>`,
        `<transkript>\n${ctx.transcript?.trim() || "(kein gesprochener Text im Video)"}\n</transkript>`,
    ];
    if (ctx.previous) {
        parts.push(`<bisheriger_entwurf>\n${JSON.stringify(ctx.previous)}\n</bisheriger_entwurf>`);
        parts.push(
            ctx.hint?.trim()
                ? `Überarbeite den bisherigen Entwurf. Hinweis des Nutzers: ${ctx.hint.trim()}`
                : "Schreibe das Rezept noch einmal sorgfältiger und vollständiger.",
        );
    } else {
        parts.push("Erstelle daraus das Rezept.");
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
    if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY fehlt – bitte in der .env eintragen.");

    const res = await fetch(`${env.ANTHROPIC_URL}/v1/messages`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-api-key": env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
        },
        signal: AbortSignal.timeout(180_000),
        body: JSON.stringify({
            model: ctx.model,
            max_tokens: 8192,
            stream: true,
            system: systemPrompt(ctx),
            tools: [{ name: "save_recipe", description: "Speichert das fertige Rezept.", input_schema: RECIPE_TOOL_SCHEMA }],
            tool_choice: { type: "tool", name: "save_recipe" },
            messages: [{ role: "user", content: [...imageBlocks(ctx.imageFiles), { type: "text", text: userText(ctx) }] }],
        }),
    });

    if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        if (res.status === 401) throw new Error("Claude lehnt den API-Key ab – ANTHROPIC_API_KEY prüfen.");
        if (res.status === 400 && /credit|balance/i.test(text)) throw new Error("Claude: kein Guthaben mehr in der Anthropic-Konsole.");
        if (res.status === 404) throw new Error(`Claude kennt das Modell „${ctx.model}“ nicht.`);
        if (res.status === 429 || res.status === 529) throw new Error("Claude ist gerade ausgelastet – bitte gleich nochmal versuchen.");
        throw new Error(`Claude-Fehler ${res.status}: ${text.slice(0, 300)}`);
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
                throw new Error(`Claude-Fehler: ${evt.error?.message || "unbekannt"}`);
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
    if (!final) throw new Error(`Claude hat kein Rezept geliefert (stop_reason: ${stopReason || "?"}).`);
    const recipe = normalize(final);
    if (!recipe.name && recipe.ingredients.length === 0) {
        throw new Error("Claude konnte im Post kein Rezept erkennen.");
    }
    return recipe;
}
