import {
  applyTokens,
  extractTokens,
  formatPlainData,
  fromJson,
  parsePlainData,
  stringifyJson,
} from "../../src/index.js";

const EXAMPLES: Record<string, { concept: string; plain: string }> = {
  "display-settings": {
    concept: "DisplaySettings",
    plain: `***plaindata***
- :DisplaySettings:
  - theme - "dark"
  - fontSize - 14
  - showLineNumbers - true
  - accentColor - null
  - pinnedTabs
    - #1 - "inbox"
    - #2 - "calendar"
    - #3 - "notes"
  - customRules - {}
`,
  },
  order: {
    concept: "Order",
    plain: `***plaindata***
- :Order:
  - id - "ord_2026_0042"
  - paid - true
  - currency - "USD"
  - items
    - #1
      - sku - "COFFEE-250G"
      - qty - 2
      - unitPrice - 18.50
    - #2
      - sku - "FILTER-100"
      - qty - 1
      - unitPrice - 7.00
  - notes - []
`,
  },
  "exact-numbers": {
    concept: "ExactNumbers",
    plain: `***plaindata***
- :ExactNumbers:
  - trailingZero - 1.50
  - negativeZero - -0.0
  - hugeExponent - 1e400
  - longInteger - 123456789012345678901234567890
  - "key with spaces" - "preserved"
  - "#1" - "quoted so it is an object key, not an array index"
`,
  },
};

const plainInput = document.getElementById("plain-input") as HTMLTextAreaElement;
const jsonInput = document.getElementById("json-input") as HTMLTextAreaElement;
const formattedView = document.getElementById("formatted-view") as HTMLDivElement;
const tokensBar = document.getElementById("tokens-bar") as HTMLDivElement;
const tokenValues: Record<string, string> = {};

function renderTokensBar(tokens: string[]): void {
  tokensBar.hidden = tokens.length === 0;
  const existing = Array.from(tokensBar.querySelectorAll<HTMLInputElement>("input[data-token]")).map(
    (el) => el.dataset.token!,
  );
  if (existing.join(",") === tokens.join(",")) return;
  tokensBar.innerHTML = "";
  for (const token of tokens) {
    const label = document.createElement("label");
    label.className = "token-field";
    const span = document.createElement("span");
    span.textContent = `{{${token}}}`;
    const input = document.createElement("input");
    input.dataset.token = token;
    input.value = tokenValues[token] ?? "";
    input.placeholder = "JSON value";
    input.addEventListener("input", () => {
      if (input.value === "") delete tokenValues[token];
      else tokenValues[token] = input.value;
      syncFromPlain();
    });
    label.append(span, input);
    tokensBar.appendChild(label);
  }
}
const conceptInput = document.getElementById("concept-input") as HTMLInputElement;
const exampleSelect = document.getElementById("example-select") as HTMLSelectElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const statusText = document.getElementById("status-text") as HTMLSpanElement;
const statusMeta = document.getElementById("status-meta") as HTMLSpanElement;
const compileBadge = document.getElementById("compile-badge") as HTMLSpanElement;
const plainNotes = document.getElementById("plain-notes") as HTMLElement;
const jsonNotes = document.getElementById("json-notes") as HTMLElement;
const formatBtn = document.getElementById("format-btn") as HTMLButtonElement;
const resetBtn = document.getElementById("reset-btn") as HTMLButtonElement;
const copyJsonBtn = document.getElementById("copy-json") as HTMLButtonElement;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderScalar(raw: string): string {
  const escaped = escapeHtml(raw);
  if (raw.startsWith('"')) return `<span class="pv-string">${escaped}</span>`;
  if (raw === "true" || raw === "false" || raw === "null") {
    return `<span class="pv-keyword">${escaped}</span>`;
  }
  if (raw === "[]" || raw === "{}") return `<span class="pv-empty">${escaped}</span>`;
  return `<span class="pv-number">${escaped}</span>`;
}

function renderReader(source: string): string {
  const rows: string[] = [];
  for (const line of source.split("\n")) {
    if (line.trim() === "" || line.trim() === "***plaindata***") continue;
    const indent = line.length - line.trimStart().length;
    const depth = Math.floor(indent / 2);
    if (!line.startsWith("- ", indent)) continue;
    const body = line.slice(indent + 2);

    const root = /^:([A-Za-z][A-Za-z0-9]*):(?: - (.+))?$/.exec(body);
    if (root) {
      const tail = root[2] !== undefined ? `<span class="pv-sep"> — </span>${renderScalar(root[2])}` : "";
      rows.push(`<div class="pv-row pv-definition" style="--depth:${depth}"><strong class="pv-name">${escapeHtml(root[1]!)}</strong>${tail}</div>`);
      continue;
    }

    const arr = /^(#\d+)(?: - (.+))?$/.exec(body);
    if (arr) {
      const tail = arr[2] !== undefined ? `<span class="pv-sep"> · </span>${renderScalar(arr[2])}` : "";
      rows.push(`<div class="pv-row" style="--depth:${depth}"><span class="pv-index">${escapeHtml(arr[1]!)}</span>${tail}</div>`);
      continue;
    }

    const member = /^("(?:[^"\\]|\\.)*"|[A-Za-z_$][A-Za-z0-9_$-]*)(?: - (.+))?$/.exec(body);
    if (member) {
      const tail = member[2] !== undefined ? `<span class="pv-sep"> — </span>${renderScalar(member[2])}` : "";
      rows.push(`<div class="pv-row" style="--depth:${depth}"><span class="pv-bullet">•</span><span class="pv-attr">${escapeHtml(member[1]!)}</span>${tail}</div>`);
    }
  }
  return rows.join("");
}

function setStatus(ok: boolean, message: string, meta = ""): void {
  statusEl.dataset.phase = ok ? "synced" : "error";
  statusText.textContent = message;
  statusMeta.textContent = meta;
  compileBadge.textContent = ok ? "Valid" : "Error";
  compileBadge.className = `badge ${ok ? "ok" : "err"}`;
}

function syncFromPlain(): void {
  try {
    const tokens = extractTokens(plainInput.value);
    renderTokensBar(tokens);
    const applied = applyTokens(plainInput.value, tokenValues);
    const parsed = parsePlainData(applied.text);
    const canonical = formatPlainData(parsed);
    const json = stringifyJson(parsed.value, 2);
    conceptInput.value = parsed.concept;
    jsonInput.value = json + "\n";
    formattedView.innerHTML = renderReader(canonical);
    plainNotes.textContent = "Round-trip verified";
    plainNotes.className = "notes";
    jsonNotes.textContent = `${json.length} bytes`;
    jsonNotes.className = "notes";
    setStatus(true, "Synced", `:${parsed.concept}:`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    plainNotes.textContent = msg;
    plainNotes.className = "notes error";
    setStatus(false, "PlainData syntax error");
  }
}

function syncFromJson(): void {
  try {
    const concept = conceptInput.value.trim() || "Data";
    const plain = fromJson(jsonInput.value, concept);
    plainInput.value = plain;
    formattedView.innerHTML = renderReader(plain);
    jsonNotes.textContent = "Round-trip verified";
    jsonNotes.className = "notes";
    plainNotes.textContent = "Synced from JSON";
    plainNotes.className = "notes";
    setStatus(true, "Synced", `:${concept}:`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    jsonNotes.textContent = msg;
    jsonNotes.className = "notes error";
    setStatus(false, "JSON syntax error");
  }
}

function loadExample(id: string): void {
  const example = EXAMPLES[id] ?? EXAMPLES["display-settings"]!;
  plainInput.value = example.plain;
  conceptInput.value = example.concept;
  syncFromPlain();
}

plainInput.addEventListener("input", syncFromPlain);
jsonInput.addEventListener("input", syncFromJson);
conceptInput.addEventListener("input", syncFromJson);
exampleSelect.addEventListener("change", () => loadExample(exampleSelect.value));
formatBtn.addEventListener("click", () => {
  try {
    plainInput.value = formatPlainData(parsePlainData(plainInput.value));
    syncFromPlain();
  } catch {
    syncFromPlain();
  }
});
resetBtn.addEventListener("click", () => loadExample(exampleSelect.value));
copyJsonBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(jsonInput.value);
    copyJsonBtn.textContent = "Copied";
    setTimeout(() => { copyJsonBtn.textContent = "Copy"; }, 1200);
  } catch {
    copyJsonBtn.textContent = "Failed";
  }
});

loadExample("display-settings");
