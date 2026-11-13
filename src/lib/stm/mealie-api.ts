import fs from "fs";
import { randomUUID } from "crypto";
import { env } from "@/lib/constants";
import { type MatchEntry, type MatchIndex, buildIndex, lookup } from "./match";
import type { DraftRecipe, Ingredient } from "./types";

interface Named {
    id: string;
    name: string;
    slug?: string;
    pluralName?: string | null;
    abbreviation?: string | null;
    pluralAbbreviation?: string | null;
    aliases?: { name: string }[] | null;
}

async function mealie(pathname: string, init: RequestInit = {}): Promise<Response> {
    const headers: Record<string, string> = {
        Authorization: `Bearer ${env.MEALIE_API_KEY}`,
        ...(init.headers as Record<string, string> | undefined),
    };
    if (init.body && !(init.body instanceof FormData) && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }
    return fetch(`${env.MEALIE_URL}${pathname}`, {
        ...init,
        headers,
        signal: init.signal ?? AbortSignal.timeout(30_000),
        cache: "no-store",
    });
}

async function mealieJson<T = any>(pathname: string, init: RequestInit = {}): Promise<T> {
    const res = await mealie(pathname, init);
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Mealie ${init.method || "GET"} ${pathname.split("?")[0]} → ${res.status} ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
}

const norm = (s: string | null | undefined) => (s || "").trim().toLocaleLowerCase("de-DE");

/* ---------- cached organizers / units ---------- */

const cache: Record<string, { at: number; items: Named[] }> = {};

async function listAll(pathname: string): Promise<Named[]> {
    const hit = cache[pathname];
    if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.items;
    const body = await mealieJson<{ items: Named[] }>(`${pathname}?perPage=-1&page=1`);
    const items = Array.isArray(body.items) ? body.items : [];
    cache[pathname] = { at: Date.now(), items };
    return items;
}

export const getUnits = () => listAll("/api/units");
export const getFoods = () => listAll("/api/foods");
export const getTags = () => listAll("/api/organizers/tags");
export const getCategories = () => listAll("/api/organizers/categories");

/** Adds a newly created item to the cached list (a new array, so the match index is rebuilt). */
function remember(pathname: string, item: Named) {
    const hit = cache[pathname];
    if (hit && item?.id) cache[pathname] = { at: hit.at, items: [...hit.items, item] };
}

function toEntry(x: Named): MatchEntry {
    const variants = [x.name, x.pluralName, x.abbreviation, x.pluralAbbreviation, ...(x.aliases || []).map((a) => a?.name)];
    return { id: x.id, name: x.name, short: x.abbreviation || undefined, variants: variants.filter((v): v is string => Boolean(v)) };
}

const indexes: Record<string, { items: Named[]; index: MatchIndex }> = {};

/** Match index for units or foods, rebuilt whenever the cached list changes. */
async function indexFor(pathname: "/api/units" | "/api/foods"): Promise<{ index: MatchIndex; byId: Map<string, Named> }> {
    const items = await listAll(pathname);
    let entry = indexes[pathname];
    if (!entry || entry.items !== items) {
        entry = { items, index: buildIndex(items.map(toEntry)) };
        indexes[pathname] = entry;
    }
    return { index: entry.index, byId: new Map(items.map((x) => [x.id, x])) };
}

/** Food and unit names for the review view (badges and suggestions). */
export async function getMatchData() {
    const [foods, units] = await Promise.all([getFoods(), getUnits()]);
    return { foods: foods.map(toEntry), units: units.map(toEntry) };
}

async function findUnit(name: string): Promise<Named | undefined> {
    const { index, byId } = await indexFor("/api/units");
    const hit = lookup(index, name);
    return hit ? byId.get(hit.id) : undefined;
}

async function findFood(name: string): Promise<Named | undefined> {
    const n = norm(name);
    if (!n) return undefined;
    try {
        const { index, byId } = await indexFor("/api/foods");
        const hit = lookup(index, name);
        if (hit) return byId.get(hit.id);
    } catch (e) {
        console.warn("Could not load Mealie foods", e);
    }
    // fallback for foods created after the list was cached
    const body = await mealieJson<{ items: Named[] }>(
        `/api/foods?search=${encodeURIComponent(name.trim())}&perPage=30&page=1`,
    );
    const items = Array.isArray(body.items) ? body.items : [];
    return items.find((x) => norm(x.name) === n || norm(x.pluralName) === n);
}

/** Marks which foods / units already exist in Mealie (for the "vorhanden" / "neu" badges). */
export async function matchIngredients(ingredients: Ingredient[]): Promise<Ingredient[]> {
    const out: Ingredient[] = [];
    for (const ing of ingredients) {
        const copy = { ...ing };
        try {
            copy.unitId = ing.unit ? (await findUnit(ing.unit))?.id ?? null : null;
        } catch {
            copy.unitId = null;
        }
        try {
            copy.foodId = ing.food ? (await findFood(ing.food))?.id ?? null : null;
        } catch {
            copy.foodId = null;
        }
        out.push(copy);
    }
    return out;
}

/* ---------- duplicates ---------- */

function urlVariants(url: string): string[] {
    const set = new Set<string>([url]);
    try {
        const u = new URL(url);
        u.search = "";
        u.hash = "";
        const base = u.toString();
        set.add(base);
        set.add(base.endsWith("/") ? base.slice(0, -1) : `${base}/`);
    } catch {
        /* ignore */
    }
    return [...set];
}

export async function findDuplicate(url: string) {
    for (const variant of urlVariants(url)) {
        const filter = `orgURL = "${variant.replace(/"/g, '\\"')}"`;
        try {
            const body = await mealieJson<{ items: any[] }>(
                `/api/recipes?queryFilter=${encodeURIComponent(filter)}&perPage=1&page=1`,
            );
            const hit = body.items?.[0];
            if (hit) {
                return {
                    name: hit.name as string,
                    slug: hit.slug as string,
                    date: (hit.dateAdded || hit.createdAt || "") as string,
                    url: recipeUrl(hit.slug),
                };
            }
        } catch (e: any) {
            // a wrong token should stop the job before Claude is paid for; other errors are not fatal
            if (/→ 40[13]/.test(String(e?.message))) throw e;
            console.warn("Duplicate check failed", e);
            return undefined;
        }
    }
    return undefined;
}

export function recipeUrl(slug: string) {
    return `${env.EXTERNAL_MEALIE_URL || env.MEALIE_URL}/g/${env.MEALIE_GROUP_NAME}/r/${slug}`;
}

/* ---------- saving ---------- */

async function ensureUnit(name: string): Promise<Named | null> {
    if (!name?.trim()) return null;
    const found = await findUnit(name);
    if (found) return found;
    const created = await mealieJson<Named>("/api/units", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
    });
    remember("/api/units", created);
    return created;
}

async function ensureFood(name: string): Promise<Named | null> {
    if (!name?.trim()) return null;
    const found = await findFood(name);
    if (found) return found;
    const created = await mealieJson<Named>("/api/foods", { method: "POST", body: JSON.stringify({ name: name.trim() }) });
    remember("/api/foods", created);
    return created;
}

function formatQty(q: number | null) {
    if (q === null || q === undefined || q === 0) return "";
    return String(Math.round(q * 1000) / 1000).replace(".", ",");
}

export async function saveRecipe(
    url: string,
    recipe: DraftRecipe,
    imageFile: string | null,
): Promise<{ slug: string; url: string; id?: string }> {
    const slug = await mealieJson<string>("/api/recipes", {
        method: "POST",
        body: JSON.stringify({ name: recipe.name.trim() || "Recipe" }),
    });

    let id: string | undefined;
    try {
        id = await fillRecipe(slug, url, recipe, imageFile);
    } catch (e) {
        // do not leave an empty recipe behind – a retry would otherwise create "name-1"
        await mealie(`/api/recipes/${encodeURIComponent(slug)}`, { method: "DELETE" }).catch(() => undefined);
        throw e;
    }
    return { slug, url: recipeUrl(slug), id };
}

async function fillRecipe(slug: string, url: string, recipe: DraftRecipe, imageFile: string | null): Promise<string | undefined> {
    const recipeIngredient: { referenceId: string; [key: string]: unknown }[] = [];
    for (const ing of recipe.ingredients) {
        const unit = ing.unit ? await ensureUnit(ing.unit) : null;
        const food = ing.food ? await ensureFood(ing.food) : null;
        const display = [formatQty(ing.quantity), unit?.abbreviation || unit?.name || "", food?.name || ing.food, ing.note || ""]
            .filter(Boolean)
            .join(" ");
        recipeIngredient.push({
            quantity: ing.quantity ?? 0,
            unit: unit ? { id: unit.id, name: unit.name } : null,
            food: food ? { id: food.id, name: food.name } : null,
            note: ing.note || null,
            display,
            originalText: null,
            referenceId: randomUUID(),
        });
    }

    const [tags, categories] = await Promise.all([getTags().catch(() => []), getCategories().catch(() => [])]);
    const pick = (list: Named[], names: string[]) =>
        names
            .map((n) => list.find((x) => norm(x.name) === norm(n)))
            .filter((x): x is Named => Boolean(x))
            .map((x) => ({ id: x.id, name: x.name, slug: x.slug }));

    const patch = {
        description: recipe.description,
        recipeServings: recipe.servings ?? 0,
        totalTime: recipe.totalTime || null,
        prepTime: recipe.prepTime || null,
        orgURL: url,
        recipeIngredient,
        recipeInstructions: recipe.instructions
            .filter((step) => step.text.trim())
            .map((step) => ({
                id: randomUUID(),
                title: "",
                summary: "",
                text: step.text,
                // Mealie shows these ingredients next to the step in cooking mode
                ingredientReferences: step.ingredients
                    .filter((i) => recipeIngredient[i])
                    .map((i) => ({ referenceId: recipeIngredient[i].referenceId })),
                // step timer
                durationSeconds: step.minutes ? Math.round(step.minutes * 60) : null,
            })),
        notes: recipe.notes.filter((n) => n.text?.trim()).map((n) => ({ title: n.title || "", text: n.text })),
        tags: pick(tags, recipe.tags),
        recipeCategory: pick(categories, recipe.category ? [recipe.category] : []),
    };

    const updated = await mealieJson<{ id?: string }>(`/api/recipes/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
    });

    if (imageFile && fs.existsSync(imageFile)) {
        try {
            const form = new FormData();
            form.append("image", new Blob([new Uint8Array(fs.readFileSync(imageFile))], { type: "image/jpeg" }), "image.jpg");
            form.append("extension", "jpg");
            const res = await mealie(`/api/recipes/${encodeURIComponent(slug)}/image`, { method: "PUT", body: form });
            if (!res.ok) console.warn("Image upload failed", res.status, await res.text().catch(() => ""));
        } catch (e) {
            console.warn("Image upload failed", e);
        }
    }
    return updated?.id;
}

/* ---------- meal plan ---------- */

export async function recipeId(slug: string): Promise<string> {
    const r = await mealieJson<{ id: string }>(`/api/recipes/${encodeURIComponent(slug)}`);
    return r.id;
}

export async function addToMealPlan(id: string, date: string, entryType: string) {
    return mealieJson("/api/households/mealplans", {
        method: "POST",
        body: JSON.stringify({ date, entryType, recipeId: id, title: "", text: "" }),
    });
}
