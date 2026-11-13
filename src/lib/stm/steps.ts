import type { RecipeStep } from "./types";

/** Accepts old string steps, Claude's (possibly partial) objects and edited steps. */
export function normalizeStep(raw: unknown): RecipeStep {
    if (typeof raw === "string") return { text: raw, minutes: null, ingredients: [] };
    const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const minutes = typeof r.minutes === "number" ? r.minutes : r.minutes ? Number(String(r.minutes).replace(",", ".")) : null;
    return {
        text: typeof r.text === "string" ? r.text : "",
        minutes: minutes !== null && Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 10) / 10 : null,
        ingredients: Array.isArray(r.ingredients)
            ? [...new Set(r.ingredients.map(Number).filter((n) => Number.isInteger(n) && n >= 0))]
            : [],
    };
}

export function normalizeSteps(raw: unknown, ingredientCount?: number): RecipeStep[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((s) => {
        const step = normalizeStep(s);
        if (ingredientCount !== undefined) step.ingredients = step.ingredients.filter((i) => i < ingredientCount);
        return step;
    });
}
