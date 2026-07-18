import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://pi-gui.pages.dev",
  integrations: [
    starlight({
      title: "pi-gui",
      description: "A localhost multi-session web UI for pi.",
      favicon: "/favicon.svg",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/ankitchouhan1020/pi-gui-extension",
        },
      ],
      editLink: {
        baseUrl: "https://github.com/ankitchouhan1020/pi-gui-extension/edit/main/docs/",
      },
      customCss: ["./src/styles/custom.css"],
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "Introduction", slug: "" },
            { label: "1. Overview", slug: "getting-started" },
            { label: "2. Install and use", slug: "getting-started/install" },
          ],
        },
        {
          label: "Concepts",
          items: [
            { label: "1. How pi-gui relates to pi", slug: "concepts/ownership" },
            { label: "2. Architecture", slug: "concepts/architecture" },
          ],
        },
        {
          label: "Extend",
          items: [
            { label: "1. Extension paths", slug: "extend" },
            { label: "2. Message plugins", slug: "extend/plugins" },
            { label: "3. Themes", slug: "extend/theme" },
            { label: "4. UI chrome", slug: "extend/ui" },
            { label: "5. Server API", slug: "extend/server-api" },
          ],
        },
        {
          label: "Recipes",
          items: [{ autogenerate: { directory: "recipes" } }],
        },
        {
          label: "Reference",
          items: [
            { label: "Repository layout", slug: "reference/layout" },
            { label: "HTTP API", slug: "reference/api" },
            { label: "SSE and client stream", slug: "reference/events" },
          ],
        },
        {
          label: "Contributing",
          items: [
            { label: "Change boundaries", slug: "contributing/boundaries" },
            { label: "Release", slug: "contributing/release" },
          ],
        },
      ],
    }),
  ],
});
