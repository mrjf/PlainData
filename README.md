# PlainData

PlainData is a controlled-natural-language notation for JSON data. It shares the
readable, Markdown-like shape of [`PlainType`](https://github.com/mrjf/PlainType)
and [`***plain`](https://www.plainlang.org/docs/), while giving every line a
deterministic grammar so a parser—not an LLM—decides its meaning.

Its primary invariant is:

```text
JSON -> PlainData -> JSON = the same JSON data
```

## Example

```plain
***plaindata***
- :DisplaySettings:
  - theme - "dark"
  - fontSize - 14
  - showLineNumbers - true
  - pinnedTabs
    - #1 - "inbox"
    - #2 - "calendar"
  - customRules - {}
```

Objects use indented member names, arrays use consecutive 1-based positions
(`#1`, `#2`, …), unusual member names use JSON string quoting, and leaves use
standard JSON scalar syntax (`[]` and `{}` for empty collections). Object member
order, array order, and raw number spellings (`1.50`, `-0.0`, `1e400`) are
preserved losslessly; duplicate object members are rejected.

## Use

Node.js 20 or newer is required.

```bash
npm install
npm run build

node dist/src/cli.js from-json examples/display-settings.json --concept DisplaySettings
node dist/src/cli.js to-json examples/display-settings.plaindata --pretty
node dist/src/cli.js check examples/display-settings.plaindata
node dist/src/cli.js format examples/display-settings.plaindata
```

Library API:

```ts
import { fromJson, toJson, parsePlainData, formatPlainData } from "plaindata";

const plain = fromJson('{"theme":"dark","fontSize":14}', "DisplaySettings");
const json = toJson(plain, { indent: 2 });
```

## Studio

The interactive [PlainData Studio](https://mrjf.github.io/PlainData/) runs
entirely in the browser—edit PlainData or JSON live with instant bidirectional
sync, syntax highlighting, and lossless round-trip verification.

```bash
cd demo
bun run build:pages
```

See [docs/language.md](docs/language.md) for the full language contract.
