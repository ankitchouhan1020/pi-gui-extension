import { defineConfig, type Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appLib = path.resolve(__dirname, "src/lib");
const kitLib = path.resolve(__dirname, "src/lib/kit");

function normalizeImporter(importer?: string): string {
  if (!importer) return "";
  if (importer.startsWith("file:")) {
    try {
      return fileURLToPath(importer);
    } catch {
      return importer;
    }
  }
  return importer;
}

function resolveLibFile(base: string, sub: string): string {
  const stripped = sub.replace(/^\//, "");
  const noExt = stripped.replace(/\.(js|ts|svelte\.ts)$/, "");
  const tries = [
    path.join(base, stripped),
    path.join(base, `${stripped}.ts`),
    path.join(base, `${stripped}.js`),
    path.join(base, `${stripped}.svelte`),
    path.join(base, `${stripped}.svelte.ts`),
    path.join(base, noExt + ".ts"),
    path.join(base, noExt + ".js"),
    path.join(base, noExt + ".svelte.ts"),
    path.join(base, noExt + ".svelte"),
    path.join(base, stripped.replace(/\.js$/, ".ts")),
    path.join(base, stripped.replace(/\.js$/, ".svelte.ts")),
  ];
  for (const t of tries) {
    try {
      if (fs.existsSync(t) && fs.statSync(t).isFile()) return t;
    } catch {
      /* ignore */
    }
  }
  return tries[0];
}

/** $lib → kit when importer is under src/lib/kit, else app lib. */
function dualLibAlias(): Plugin {
  return {
    name: "dual-lib-alias",
    enforce: "pre",
    resolveId(source, importer) {
      if (!source.startsWith("$lib")) return null;
      const imp = normalizeImporter(importer);
      const fromKit = /[/\\]lib[/\\]kit([/\\]|$)/.test(imp);
      const base = fromKit ? kitLib : appLib;
      const sub =
        source === "$lib" || source === "$lib/"
          ? "index.ts"
          : source.replace(/^\$lib\/?/, "");
      return resolveLibFile(base, sub);
    },
  };
}

export default defineConfig({
  plugins: [dualLibAlias(), tailwindcss(), svelte()],
  resolve: {
    alias: {
      "agentic-ui-kit": kitLib,
    },
    dedupe: ["svelte"],
  },
  // Package root so npm pack includes it (web/.gitignore ignores local dist/)
  build: {
    outDir: path.resolve(__dirname, "../dist"),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      // SSE (/events) must not hit proxy idle timeouts
      "/api": {
        target: "http://127.0.0.1:3847",
        timeout: 0,
        proxyTimeout: 0,
      },
    },
  },
});
