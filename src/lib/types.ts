export type recipeInfo = {
    postURL: string;
    transcription: string;
    thumbnail: string;
    description: string;
};

export type envTypes = {
    OPENAI_URL: string;
    OPENAI_API_KEY: string;
    TRANSCRIPTION_MODEL: string;
    TEXT_MODEL: string;
    MEALIE_URL: string;
    EXTERNAL_MEALIE_URL: string;
    MEALIE_API_KEY: string;
    MEALIE_GROUP_NAME: string;
    FFMPEG_PATH: string;
    YTDLP_PATH: string;
    EXTRA_PROMPT: string;
    COOKIES: string;
    LOCAL_TRANSCRIPTION_MODEL: string;
    ANTHROPIC_API_KEY: string;
    ANTHROPIC_URL: string;
    DATA_DIR: string;
    CLAUDE_MODEL_FAST: string;
    CLAUDE_MODEL_SMART: string;
    GOTIFY_URL: string;
    GOTIFY_TOKEN: string;
    APP_URL: string;
    RETENTION_DAYS: number;
    APP_LANGUAGE: "de" | "en";
};

export type recipeResult = {
    name: string;
    description: string;
    imageUrl: string;
    url: string;
};

export type progressType = {
    videoDownloaded: null | boolean;
    audioTranscribed: null | boolean;
    recipeCreated: null | boolean;
};

export type socialMediaResult = {
    blob: Blob | null;
    thumbnail: string;
    description: string;
    title: string;
    images: string[];
};

export type tag = {
    id: string;
    groupId: string;
    name: string;
    slug: string;
};

export type Option = {
    label: string;
    value: string;
};
