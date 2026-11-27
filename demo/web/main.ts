import {
  applyTokens,
  extractTokens,
  formatPlainData,
  fromJson,
  parsePlainData,
  stringifyJson,
  type TokenSpan,
} from "../../src/index.js";

const DEFAULT_TOKENS: Record<string, string> = {
  theme: '"dark"',
  fontSize: "14",
  defaultChecked: "false",
  accentColor: '"#2c56c9"',
};

const EXAMPLES: Record<string, { concept: string; plain: string }> = {
  "display-settings": {
    concept: "DisplaySettings",
    plain: `***plaindata***
- :DisplaySettings:
  - theme - {{theme}}
  - fontSize - {{fontSize}}
  - showLineNumbers - true
  - accentColor - {{accentColor}}
  - pinnedTabs
    - #1 - "inbox"
    - #2 - "calendar"
    - #3 - "notes"
  - customRules - {}
`,
  },
  "checkbox-fixtures": {
    concept: "CheckboxFixtures",
    plain: `***plaindata***
- :CheckboxFixtures:
  - unchecked
    - label - "Email notifications"
    - checked - {{defaultChecked}}
    - disabled - false
    - accent - {{accentColor}}
  - checked
    - label - "Email notifications"
    - checked - true
    - disabled - false
    - accent - {{accentColor}}
  - disabledUnchecked
    - label - "Locked preference"
    - checked - false
    - disabled - true
    - accent - {{accentColor}}
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

const tokenValues: Record<string, string> = { ...DEFAULT_TOKENS };

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function clipSpans(spans: readonly TokenSpan[], start: number, end: number): TokenSpan[] {
  const out: TokenSpan[] = [];
  for (const s of spans) {
    if (s.start < end && start < s.end) {
      out.push({
        token: s.token,
        start: Math.max(s.start, start) - start,
        end: Math.min(s.end, end) - start,
      });
    }
  }
  return out;
}

function paintSlice(text: string, spans: readonly TokenSpan[]): string {
  if (spans.length === 0) return escapeHtml(text);
  let html = "";
  let cursor = 0;
  for (const s of spans) {
    if (s.start > cursor) html += escapeHtml(text.slice(cursor, s.start));
    html += `<span class="pv-token-resolved" data-token="${escapeHtml(s.token)}" title="{{${escapeHtml(s.token)}}}">${escapeHtml(text.slice(s.start, s.end))}</span>`;
    cursor = s.end;
  }
  if (cursor < text.length) html += escapeHtml(text.slice(cursor));
  return html;
}

function renderScalar(raw: string, spans: readonly TokenSpan[]): string {
  if (raw.startsWith('"')) return `<span class="pv-string">${paintSlice(raw, spans)}</span>`;
  if (raw === "true" || raw === "false" || raw === "null") {
    return `<span class="pv-keyword">${paintSlice(raw, spans)}</span>`;
  }
  if (raw === "[]" || raw === "{}") return `<span class="pv-empty">${paintSlice(raw, spans)}</span>`;
  return `<span class="pv-number">${paintSlice(raw, spans)}</span>`;
}

function renderReader(source: string, spans: readonly TokenSpan[] = []): string {
  const normalized = source.replace(/\r\n/g, "\n");
  const rows: string[] = [];
  let offset = 0;
  for (const line of normalized.split("\n")) {
    const base = offset;
    offset += line.length + 1;
    if (line.trim() === "" || line.trim() === "***plaindata***") continue;
    const indent = line.length - line.trimStart().length;
    const depth = Math.floor(indent / 2);
    if (!line.startsWith("- ", indent)) continue;
    const bodyStart = indent + 2;
    const body = line.slice(bodyStart);
    const bodySpans = clipSpans(spans, base + bodyStart, base + line.length);

    const root = /^:([A-Za-z][A-Za-z0-9]*):(?: - (.+))?$/.exec(body);
    if (root) {
      const valStart = root[1]!.length + 5;
      const tail = root[2] !== undefined ? `<span class="pv-sep"> — </span>${renderScalar(root[2], clipSpans(bodySpans, valStart, body.length))}` : "";
      rows.push(`<div class="pv-row pv-definition" style="--depth:${depth}"><strong class="pv-name">${escapeHtml(root[1]!)}</strong>${tail}</div>`);
      continue;
    }

    const arr = /^(#\d+)(?: - (.+))?$/.exec(body);
    if (arr) {
      const valStart = arr[1]!.length + 3;
      const tail = arr[2] !== undefined ? `<span class="pv-sep"> · </span>${renderScalar(arr[2], clipSpans(bodySpans, valStart, body.length))}` : "";
      rows.push(`<div class="pv-row" style="--depth:${depth}"><span class="pv-index">${escapeHtml(arr[1]!)}</span>${tail}</div>`);
      continue;
    }

    const member = /^("(?:[^"\\]|\\.)*"|[A-Za-z_$][A-Za-z0-9_$-]*)(?: - (.+))?$/.exec(body);
    if (member) {
      const valStart = member[1]!.length + 3;
      const tail = member[2] !== undefined ? `<span class="pv-sep"> — </span>${renderScalar(member[2], clipSpans(bodySpans, valStart, body.length))}` : "";
      rows.push(`<div class="pv-row" style="--depth:${depth}"><span class="pv-bullet">•</span><span class="pv-attr">${escapeHtml(member[1]!)}</span>${tail}</div>`);
    }
  }
  return rows.join("");
}

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
    const json = stringifyJson(parsed.value, 2);
    conceptInput.value = parsed.concept;
    jsonInput.value = json + "\n";
    formattedView.innerHTML = renderReader(applied.text, applied.spans);
    const tokNote = tokens.length ? ` • ${tokens.length} tokens` : "";
    plainNotes.textContent = `Round-trip verified${tokNote}`;
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
    renderTokensBar([]);
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
  Object.assign(tokenValues, DEFAULT_TOKENS);
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
    const applied = applyTokens(plainInput.value, tokenValues);
    plainInput.value = formatPlainData(parsePlainData(applied.text));
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
