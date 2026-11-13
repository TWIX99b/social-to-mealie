// Shared types for the redesigned social-to-mealie (jobs, drafts, settings).

export type JobStatus =
    | "queued"
    | "downloading"
    | "transcribing"
    | "writing"
    | "draft"
    | "saving"
    | "saved"
    | "failed"
    | "duplicate"
    | "discarded";

export const ACTIVE_STATUSES: JobStatus[] = ["downloading", "transcribing", "writing", "saving"];

export interface Ingredient {
    quantity: number | null;
    unit: string | null;
    food: string;
    note: string | null;
    /** Set when the food / unit exists in Mealie (filled by the server). */
    foodId?: string | null;
    unitId?: string | null;
}

export interface RecipeNote {
    title: string;
    text: string;
}

export interface DraftRecipe {
    name: string;
    description: string;
    servings: number | null;
    totalTime: string | null;
    prepTime: string | null;
    ingredients: Ingredient[];
    instructions: string[];
    notes: RecipeNote[];
    tags: string[];
    category: string | null;
}

export interface JobTimings {
    download?: number;
    transcribe?: number;
    write?: number;
    save?: number;
}

export interface Job {
    id: string;
    url: string;
    status: JobStatus;
    /** "ui" (this app), "shortcut" (iOS Kurzbefehl / API), "share" (Android share target) */
    source: string;
    direct: boolean;
    createdAt: string;
    updatedAt: string;
    platform?: string;
    title?: string;
    description?: string;
    transcript?: string;
    /** number of stored images (thumbnail first), served by /api/jobs/:id/image/:n */
    imageCount: number;
    recipe?: DraftRecipe;
    error?: string;
    duplicateOf?: { name: string; slug: string; date?: string; url: string };
    mealieSlug?: string;
    mealieUrl?: string;
    model?: string;
    hint?: string;
    /** internal flags for the next run */
    mode?: "full" | "rewrite";
    force?: boolean;
    timings: JobTimings;
    stageStartedAt?: string;
}

export interface Settings {
    rules: {
        german: boolean;
        metric: boolean;
        spoons: boolean;
        oven: boolean;
        existingTags: boolean;
    };
    freeText: string;
    model: "auto" | "fast" | "smart";
}

export const DEFAULT_SETTINGS: Settings = {
    rules: { german: true, metric: true, spoons: true, oven: true, existingTags: true },
    freeText: "",
    model: "auto",
};

export type StmEvent =
    | { type: "snapshot"; jobs: Job[] }
    | { type: "job"; job: Job }
    | { type: "remove"; id: string }
    | { type: "partial"; id: string; recipe: Partial<DraftRecipe> };
