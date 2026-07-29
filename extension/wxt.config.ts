import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  srcDir: "src",
  manifest: {
    action: {
      default_title: "KeyNest",
    },
    content_security_policy: {
      extension_pages:
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
    description:
      "Autofill, generate, and save credentials in your encrypted self-hosted vault.",
    host_permissions: ["http://*/*", "https://*/*"],
    minimum_chrome_version: "122",
    name: "KeyNest",
    permissions: ["storage", "tabs"],
  },
});
