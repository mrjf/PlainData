# PlainData Language Contract

PlainData is a deterministic, `***plain`-aligned notation for JSON data.

## Primary invariant

```text
JSON -> PlainData -> JSON = the same JSON data
```

PlainData preserves:
- Object member order
- Array order
- Exact raw JSON number tokens (such as `1.50`, `-0.0`, `1e400`, or 40-digit integers)
- String values and empty collections (`[]` and `{}`)

PlainData rejects duplicate object member names.

## Grammar

A PlainData document consists of:

1. The header line `***plaindata***`.
2. A named root declaration `- :<Concept>:` where `<Concept>` matches `/^[A-Za-z][A-Za-z0-9]*$/`.
3. Either an inline scalar/empty-collection value (` - <json>`) or indented child members at two-space indentation increments (`  - ...`).

### Objects

Nonempty objects list each member on its own indented line:
- Identifier keys matching `/^[A-Za-z_$][A-Za-z0-9_$-]*$/` are written bare (`- theme - "dark"`).
- All other keys (including keys with spaces, punctuation, empty strings, or `#1`) are written as JSON-quoted strings (`- "with space" - 2`).

Empty objects are written inline as `{}`.

### Arrays

Nonempty arrays list each element with consecutive 1-based position markers (`#1`, `#2`, `#3`, …):

```plain
***plaindata***
- :Tags:
  - #1 - "work"
  - #2 - "urgent"
```

Empty arrays are written inline as `[]`.

### Leaves

Scalars (`null`, `true`, `false`, numbers, strings) and empty collections (`[]`, `{}`) are written after ` - ` using standard JSON syntax. Nonempty objects and arrays must use indented members rather than inline JSON.
