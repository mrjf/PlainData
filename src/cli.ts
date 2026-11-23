#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { formatPlainDataText, fromJson, parsePlainData, toJson } from "./index.js";

function usage(): never {
  process.stderr.write(
    [
      "Usage:",
      "  plaindata from-json [file] [--concept Name] [-o out]",
      "  plaindata to-json [file] [--pretty] [-o out]",
      "  plaindata check [file]",
      "  plaindata format [file] [-o out]",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

function readInput(path?: string): string {
  return path ? readFileSync(path, "utf8") : readFileSync(0, "utf8");
}

function writeOutput(text: string, outPath?: string): void {
  if (outPath) {
    writeFileSync(outPath, text, "utf8");
  } else {
    process.stdout.write(text);
  }
}

const args = process.argv.slice(2);
const command = args.shift();
if (!command || command === "-h" || command === "--help") usage();

let inputPath: string | undefined;
let outPath: string | undefined;
let concept = "Data";
let pretty = false;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i]!;
  if (arg === "-o" || arg === "--output") {
    outPath = args[++i];
    if (!outPath) usage();
  } else if (arg === "--concept" || arg === "-c") {
    concept = args[++i] ?? "";
    if (!concept) usage();
  } else if (arg === "--pretty") {
    pretty = true;
  } else if (arg.startsWith("-")) {
    usage();
  } else if (!inputPath) {
    inputPath = arg;
  } else {
    usage();
  }
}

try {
  const input = readInput(inputPath);
  if (command === "from-json") {
    writeOutput(fromJson(input, concept), outPath);
  } else if (command === "to-json") {
    const output = toJson(input, pretty ? 2 : undefined) + "\n";
    writeOutput(output, outPath);
  } else if (command === "format") {
    writeOutput(formatPlainDataText(input), outPath);
  } else if (command === "check") {
    const parsed = parsePlainData(input);
    process.stdout.write(`OK :${parsed.concept}:\n`);
  } else {
    usage();
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
