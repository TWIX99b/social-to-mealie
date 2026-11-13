import {env} from "./constants";
import {createOpenAI} from "@ai-sdk/openai";
import {generateText, NoTranscriptGeneratedError, Output, transcribe} from "ai";
import {z} from "zod";
import {pipeline, env as hfEnv} from '@huggingface/transformers';
import path from 'path';
import {WaveFile} from 'wavefile';

// Keep downloaded Whisper models in the data volume so they survive container updates.
try {
    hfEnv.cacheDir = path.join(env.DATA_DIR, 'models');
} catch {
    /* ignore */
}

const client = createOpenAI({
    baseURL: env.OPENAI_URL,
    apiKey: env.OPENAI_API_KEY,
});

const transcriptionModel = client.transcription(env.TRANSCRIPTION_MODEL);
const textModel = client.chat(env.TEXT_MODEL);

/** Claude (Anthropic API) is used for the recipe text when ANTHROPIC_API_KEY is set. */
const useClaude = Boolean(env.ANTHROPIC_API_KEY);

const recipeSchema = z.object({
    "@context": z.literal("https://schema.org"),
    "@type": z.literal("Recipe"),
    name: z.string(),
    image: z.string().nullable(),
    url: z.string().nullable(),
    description: z.string(),
    recipeIngredient: z.array(z.string()),
    recipeInstructions: z.array(
        z.object({
            "@type": z.literal("HowToStep"),
            text: z.string(),
        })
    ),
    keywords: z.array(z.string()).nullable(),
    nutrition: z.object({
        "@type": z.literal("NutritionInformation"),
        calories: z.string().nullable(),
        carbohydrateContent: z.string().nullable(),
        proteinContent: z.string().nullable(),
        fatContent: z.string().nullable(),
        cholesterolContent: z.string().nullable(),
        fiberContent: z.string().nullable(),
        sugarContent: z.string().nullable(),
        sodiumContent: z.string().nullable(),
    }).nullable()
});

type Recipe = z.infer<typeof recipeSchema>;

const SYSTEM_PROMPT =
    "You are an expert chef assistant. Review the provided recipe information (such as description, metadata, images, and audio transcription if available) and extract or refine the recipe for clarity, conciseness, and accuracy.\n" +
    "Ensure ingredients and instructions are well-formatted and easy to follow.\n" +
    "Correct any obvious errors or omissions.\n" +
    "Output must be valid JSON-LD Schema.org Recipe format.\n" +
    "Return unavailable optional values as null instead of omitting them.\n" +
    "Do not invent nutrition values; use null for nutrition fields that are not reliably available, or null for nutrition if no reliable nutrition data is present.\n" +
    "Preserve any supplied keywords exactly. If no keywords are supplied, return keywords as null.";

export async function getTranscription(blob: Blob): Promise<string> {
    if (env.LOCAL_TRANSCRIPTION_MODEL) {
        console.info("Using local Whisper model for transcription:", env.LOCAL_TRANSCRIPTION_MODEL);
        const transcriber = await pipeline('automatic-speech-recognition', env.LOCAL_TRANSCRIPTION_MODEL);
        const arrayBuffer = Buffer.from(await blob.arrayBuffer());
        try {
            const wav = new WaveFile(new Uint8Array(arrayBuffer));
            wav.toBitDepth('32f');
            wav.toSampleRate(16000);
            let audioData: any = wav.getSamples();
            const result = await transcriber(audioData);

            if (result && typeof result === 'object' && 'text' in result) {
                return (result as any).text || "";
            }

            return String(result || "");
        } catch (err) {
            console.error('Error transcribing with local Whisper model:', err);
            throw err;
        }
    }

    try {
        const audioBuffer = Buffer.from(await blob.arrayBuffer());

        const result = await transcribe({
            model: transcriptionModel,
            audio: audioBuffer,
        });

        return result.text || "";
    } catch (error) {
        if (
            NoTranscriptGeneratedError.isInstance(error) ||
            (error instanceof Error && error.name === "AI_NoTranscriptGeneratedError")
        ) {
            console.warn("No transcript generated for audio (e.g. music only or silent audio):", error);
            return "";
        }
        console.error("Error in getTranscription (AI SDK):", error);
        throw new Error("Failed to transcribe audio via API");
    }
}

export async function generateRecipeFromAI(
    transcription: string,
    description: string,
    postURL: string,
    thumbnail: string,
    extraPrompt: string,
    tags: string[],
    images: string[],
) {
    try {
        const hasTranscription = Boolean(transcription?.trim());
        const transcriptionContent = hasTranscription
            ? transcription.trim()
            : "The video doesn't have any audio to transcribe";

        const userPrompt = `<Metadata>
            Post URL: ${postURL}
            Description: ${description}
            Thumbnail: ${thumbnail}
        </Metadata>

        <Transcription>
        ${transcriptionContent}
        </Transcription>
        ${
            tags && tags.length > 0 && Array.isArray(tags)
                ? `<keywords>${tags.join(", ")}</keywords>`
                : ""
        }

        ${
            tags && tags.length > 0 && !Array.isArray(tags)
                ? `<keywords>${tags}</keywords>`
                : ""
        }

        Use the thumbnail for the image field and the post URL for the url field.
        Extract ingredients and instructions clearly${hasTranscription ? "." : " from the description, images, and metadata."}
        Output must be valid JSON-LD Schema.org Recipe format.
        ${
            extraPrompt.length > 1
                ? ` Also the user requests that:
        ${extraPrompt}`
                : ""
        }
        `;

        if (useClaude) {
            return await generateRecipeWithClaude(userPrompt, images, thumbnail, postURL);
        }

        const {output} = await generateText({
            model: textModel,
            output: Output.object({schema: recipeSchema}),
            allowSystemInMessages: true,
            messages: [
                {
                    role: "system",
                    content: SYSTEM_PROMPT,
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text" as const,
                            text: userPrompt,
                        },
                        ...images.filter(img => img).map(img => ({
                            type: "image" as const,
                            image: img,
                        }))
                    ],
                }
            ],
        });
        return output;
    } catch
        (error) {
        console.error("Error generating recipe with AI:", error);
        throw new Error("Failed to generate recipe structure");
    }
}

/* ------------------------------------------------------------------ */
/* Claude (Anthropic Messages API) – no extra npm dependency needed.   */
/* The recipe is returned through a forced tool call whose input       */
/* schema is the recipe schema, then validated with zod.               */
/* ------------------------------------------------------------------ */

const CLAUDE_MAX_IMAGES = 10;
const CLAUDE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

function toClaudeImage(dataUrl: string) {
    const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl || "");
    if (!match) return null;
    const mediaType = match[1].toLowerCase();
    if (!CLAUDE_IMAGE_TYPES.includes(mediaType)) return null;
    return {
        type: "image" as const,
        source: {type: "base64" as const, media_type: mediaType, data: match[2]},
    };
}

function recipeInputSchema(): Record<string, unknown> {
    const schema = z.toJSONSchema(recipeSchema) as Record<string, unknown>;
    delete schema.$schema;
    return schema;
}

/** Claude sometimes leaves out constant or null fields – fill them before validating. */
function normalizeClaudeRecipe(input: any, thumbnail: string, postURL: string): Recipe {
    const r = (input && typeof input === "object") ? {...input} : {};
    r["@context"] = "https://schema.org";
    r["@type"] = "Recipe";
    r.name = typeof r.name === "string" ? r.name : "";
    r.description = typeof r.description === "string" ? r.description : "";
    r.image = r.image ?? (thumbnail && thumbnail !== "notfound" ? thumbnail : null);
    r.url = r.url ?? (postURL || null);
    r.recipeIngredient = Array.isArray(r.recipeIngredient) ? r.recipeIngredient.map(String) : [];
    r.recipeInstructions = Array.isArray(r.recipeInstructions)
        ? r.recipeInstructions.map((step: any) => ({
            "@type": "HowToStep",
            text: typeof step === "string" ? step : String(step?.text ?? ""),
        }))
        : [];
    r.keywords = Array.isArray(r.keywords) ? r.keywords.map(String) : null;
    if (r.nutrition && typeof r.nutrition === "object") {
        const n: Record<string, unknown> = {"@type": "NutritionInformation"};
        for (const key of ["calories", "carbohydrateContent", "proteinContent", "fatContent",
            "cholesterolContent", "fiberContent", "sugarContent", "sodiumContent"]) {
            const value = r.nutrition[key];
            n[key] = value === undefined || value === null ? null : String(value);
        }
        r.nutrition = n;
    } else {
        r.nutrition = null;
    }
    return recipeSchema.parse(r);
}

async function generateRecipeWithClaude(
    userPrompt: string,
    images: string[],
    thumbnail: string,
    postURL: string,
): Promise<Recipe> {
    const imageBlocks = images
        .filter(Boolean)
        .map(toClaudeImage)
        .filter((block): block is NonNullable<ReturnType<typeof toClaudeImage>> => block !== null)
        .slice(0, CLAUDE_MAX_IMAGES);

    console.info(`Generating recipe with Claude (${env.TEXT_MODEL}), ${imageBlocks.length} image(s)`);

    const response = await fetch(`${env.ANTHROPIC_URL}/v1/messages`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-api-key": env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
        },
        signal: AbortSignal.timeout(120_000),
        body: JSON.stringify({
            model: env.TEXT_MODEL,
            max_tokens: 8192,
            system: SYSTEM_PROMPT,
            tools: [{
                name: "save_recipe",
                description: "Save the extracted recipe as a JSON-LD Schema.org Recipe.",
                input_schema: recipeInputSchema(),
            }],
            tool_choice: {type: "tool", name: "save_recipe"},
            messages: [{
                role: "user",
                content: [...imageBlocks, {type: "text", text: userPrompt}],
            }],
        }),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Claude API error ${response.status}: ${errorText.slice(0, 500)}`);
    }

    const data: any = await response.json();
    const toolUse = Array.isArray(data?.content)
        ? data.content.find((block: any) => block?.type === "tool_use" && block?.name === "save_recipe")
        : undefined;

    if (!toolUse) {
        throw new Error(`Claude returned no recipe (stop_reason: ${data?.stop_reason ?? "unknown"})`);
    }

    return normalizeClaudeRecipe(toolUse.input, thumbnail, postURL);
}
