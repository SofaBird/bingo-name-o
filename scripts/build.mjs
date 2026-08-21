import { cp, mkdir, rm } from "node:fs/promises";

const files = [
  "index.html",
  "styles.css",
  "app.js",
  "mobile.html",
  "mobile.css",
  "mobile.js",
  "results.html",
  "results.css",
  "results.js",
  "admin.html",
  "admin.css",
  "admin.js",
  "favicon.svg",
];

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await Promise.all(files.map((file) => cp(file, `dist/${file}`)));
