import {
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
const formattedView = document.getElementById("formatted-view") as HTMLPreElement;
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

function highlightScalar(raw: string): string {
  const escaped = escapeHtml(raw);
  if (raw.startsWith('"')) return `<span class="t-string">${escaped}</span>`;
  if (raw === "true" || raw === "false" || raw === "null") {
    return `<span class="t-keyword">${escaped}</span>`;
  }
  if (raw === "[]" || raw === "{}") return `<span class="t-punct">${escaped}</span>`;
  return `<span class="t-number">${escaped}</span>`;
}

function highlightPlainData(source: string): string {
  return source
    .split("\n")
    .map((line) => {
      if (line === "***plaindata***") {
        return `<span class="t-header">${escapeHtml(line)}</span>`;
      }
      const root = line.match(/^(- )(:[A-Za-z][A-Za-z0-9]*:)( - (.+))?$/);
      if (root) {
        const tail = root[4] !== undefined
          ? `<span class="t-punct"> - </span>${highlightScalar(root[4])}`
          : "";
        return `<span class="t-bullet">${root[1]}</span><span class="t-concept">${escapeHtml(root[2]!)}</span>${tail}`;
      }
      const member = line.match(/^(\s*- )((?:#\d+)|(?:"(?:[^"\\]|\\.)*")|(?:[A-Za-z_$][A-Za-z0-9_$-]*))( - (.+))?$/);
      if (member) {
        const key = member[2]!;
        const keyClass = key.startsWith("#") ? "t-index" : key.startsWith('"') ? "t-string" : "t-name";
        const tail = member[4] !== undefined
          ? `<span class="t-punct"> - </span>${highlightScalar(member[4])}`
          : "";
        return `<span class="t-bullet">${member[1]}</span><span class="${keyClass}">${escapeHtml(key)}</span>${tail}`;
      }
      return escapeHtml(line);
    })
    .join("\n");
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
    const parsed = parsePlainData(plainInput.value);
    const canonical = formatPlainData(parsed);
    const json = stringifyJson(parsed.value, 2);
    conceptInput.value = parsed.concept;
    jsonInput.value = json + "\n";
    formattedView.innerHTML = highlightPlainData(canonical);
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
    formattedView.innerHTML = highlightPlainData(plain);
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
