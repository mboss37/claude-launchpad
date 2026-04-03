import { readFileSync, writeFileSync } from "node:fs";

const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const cliPath = "src/cli.ts";
const cli = readFileSync(cliPath, "utf8");
const updated = cli.replace(
  /\.version\("[^"]+",/,
  `.version("${version}",`,
);
writeFileSync(cliPath, updated);
console.log(`Synced cli.ts version to ${version}`);
