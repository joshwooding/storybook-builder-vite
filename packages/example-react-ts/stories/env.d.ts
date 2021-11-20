/// <reference types="vite/client" />

interface ImportMetaEnv extends Readonly<Record<string, string>> {
    readonly STORYBOOK: string
    // more env variables...
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
