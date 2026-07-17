#!/usr/bin/env node
/**
 * Standalone entry: node server/cli.js [--port 3847]
 */
import { createServer } from "./http.js";

const args = process.argv.slice(2);
let port = Number(process.env.PI_GUI_PORT || 3847);
const i = args.indexOf("--port");
if (i >= 0 && args[i + 1]) port = Number(args[i + 1]);

const app = createServer({ port });
app.listen();

// Last-resort log; static/API handlers must not throw uncaught (see http.js sendFile).
process.on("uncaughtException", (err) => {
  console.error("[pi-gui] uncaughtException", err?.message || err);
});
process.on("unhandledRejection", (err) => {
  console.error("[pi-gui] unhandledRejection", err);
});

process.on("SIGINT", async () => {
  await app.close();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await app.close();
  process.exit(0);
});
