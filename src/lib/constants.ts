import type { envTypes } from "@//lib/types";

export const env: envTypes = {
    OPENAI_URL: process.env.OPENAI_URL?.trim().replace(/\/+$/, "") as string,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY?.trim() as string,
    TRANSCRIPTION_MODEL: (
        process.env.TRANSCRIPTION_MODEL || process.env.TRANSCRIPTION_MODEL
    )?.trim() as string,
    TEXT_MODEL: process.env.TEXT_MODEL?.trim() as string,
    MEALIE_URL: process.env.MEALIE_URL?.trim().replace(/\/+$/, "") as string,
    EXTERNAL_MEALIE_URL: process.env.EXTERNAL_MEALIE_URL?.trim().replace(
        /\/+$/,
        "",
    ) as string,
    MEALIE_API_KEY: process.env.MEALIE_API_KEY?.trim().replace(
        /\n/g,
        "",
    ) as string,
    MEALIE_GROUP_NAME:
        process.env.MEALIE_GROUP_NAME?.trim() || ("home" as string),
    FFMPEG_PATH:
        process.env.FFMPEG_PATH?.trim() || ("/usr/bin/ffmpeg" as string),
    YTDLP_PATH: process.env.YTDLP_PATH?.trim() || ("./yt-dlp" as string),
    EXTRA_PROMPT: process.env.EXTRA_PROMPT?.trim() || ("" as string),
    COOKIES: process.env.COOKIES?.trim() || ("" as string),
    LOCAL_TRANSCRIPTION_MODEL:
        process.env.LOCAL_TRANSCRIPTION_MODEL?.trim() || ("" as string),
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY?.trim() || ("" as string),
    ANTHROPIC_URL: (
        process.env.ANTHROPIC_URL?.trim() || "https://api.anthropic.com"
    ).replace(/\/+$/, "") as string,
    DATA_DIR: process.env.DATA_DIR?.trim() || "/app/data",
    CLAUDE_MODEL_FAST:
        process.env.CLAUDE_MODEL_FAST?.trim() || process.env.TEXT_MODEL?.trim() || "claude-haiku-5-5",
    CLAUDE_MODEL_SMART: process.env.CLAUDE_MODEL_SMART?.trim() || "claude-sonnet-5-5",
    GOTIFY_URL: (process.env.GOTIFY_URL?.trim() || "").replace(/\/+$/, ""),
    GOTIFY_TOKEN: process.env.GOTIFY_TOKEN?.trim() || "",
    APP_URL: (process.env.APP_URL?.trim() || "").replace(/\/+$/, ""),
    APP_LANGUAGE: process.env.APP_LANGUAGE?.trim().toLowerCase().startsWith("de") ? "de" : "en",
    RETENTION_DAYS: Number(process.env.RETENTION_DAYS || 10),
};
