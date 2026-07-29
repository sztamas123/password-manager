interface ImportMetaEnv {
  readonly WXT_PUBLIC_API_BASE_URL?: string;
  readonly WXT_PUBLIC_WEB_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
