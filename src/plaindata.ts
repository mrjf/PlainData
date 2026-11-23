import {
  parseJson,
  stringifyJson,
  type JsonNode,
  type JsonObjectEntry,
} from "./json.js";

export interface PlainData {
  readonly concept: string;
  readonly value: JsonNode;
}

export class PlainDataError extends Error {
  public readonly line: number | undefined;

  public constructor(message: string, line?: number) {
    super(line !== undefined ? `PlainData line ${line}: ${message}` : message);
    this.name = "PlainDataError";
    this.line = line;
  }
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$-]*$/;
const QUOTED = /^"(?:[^"\\]|\\.)*"/;
const CONCEPT_NAME = /^[A-Za-z][A-Za-z0-9]*$/;
const MEMBER_TOKEN = /^(?:#\d+|[A-Za-z_$][A-Za-z0-9_$-]*)/;

export function formatPlainData({ concept, value }: PlainData): string {
  if (!CONCEPT_NAME.test(concept)) {
    throw new PlainDataError(`Invalid PlainData concept name "${concept}"`);
  }
  const lines = ["***plaindata***"];

  function visit(key: string, node: JsonNode, depth: number): void {
    const prefix = "  ".repeat(depth) + "- " + key;
    if (node.type === "array" && node.items.length > 0) {
      lines.push(prefix);
      node.items.forEach((child, index) => visit("#" + (index + 1), child, depth + 1));
    } else if (node.type === "object" && node.entries.length > 0) {
      lines.push(prefix);
      const keys = new Set<string>();
      for (const entry of node.entries) {
        if (keys.has(entry.key)) {
          throw new PlainDataError(`Repeated member "${entry.key}"`);
        }
        keys.add(entry.key);
        const keyToken = IDENTIFIER.test(entry.key) ? entry.key : JSON.stringify(entry.key);
        visit(keyToken, entry.value, depth + 1);
      }
    } else {
      lines.push(prefix + " - " + stringifyJson(node));
    }
  }

  visit(":" + concept + ":", value, 0);
  return lines.join("\n") + "\n";
}

export function parsePlainData(source: string): PlainData {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  if (lines.shift() !== "***plaindata***") {
    throw new PlainDataError("Expected ***plaindata***", 1);
  }
  const rootLine = lines[0];
  const root = rootLine?.match(/^- :([A-Za-z][A-Za-z0-9]*):(.*)$/);
  if (!root) {
    throw new PlainDataError("Expected named PlainData root at line 2", 2);
  }

  let cursor = 1;
  const fail = (message: string, line = cursor + 1): never => {
    throw new PlainDataError(message, line);
  };

  function parseValue(rest: string, depth: number): JsonNode {
    if (rest.startsWith(" - ")) {
      let scalar: JsonNode;
      try {
        scalar = parseJson(rest.slice(3));
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err));
      }
      if (
        (scalar.type === "array" && scalar.items.length > 0) ||
        (scalar.type === "object" && scalar.entries.length > 0)
      ) {
        return fail("Use indented members for a nonempty collection");
      }
      return scalar;
    }
    if (rest !== "") {
      return fail("Expected a value or indented members");
    }

    const prefix = "  ".repeat(depth) + "- ";
    const items: JsonNode[] = [];
    const entries: JsonObjectEntry[] = [];
    const seen = new Set<string>();

    while (lines[cursor]?.startsWith(prefix)) {
      const lineNo = cursor + 2;
      const member = lines[cursor++]!.slice(prefix.length);
      const token = member.match(QUOTED)?.[0] ?? member.match(MEMBER_TOKEN)?.[0];
      if (!token) {
        return fail("Expected a member name or array position", lineNo);
      }
      const suffix = member.slice(token.length);
      if (token.startsWith("#")) {
        if (entries.length > 0 || token !== "#" + (items.length + 1)) {
          return fail("Expected consecutive array positions", lineNo);
        }
        items.push(parseValue(suffix, depth + 1));
      } else {
        const key = token.startsWith('"') ? (JSON.parse(token) as string) : token;
        if (items.length > 0 || seen.has(key)) {
          return fail(`Mixed collection or duplicate member "${key}"`, lineNo);
        }
        seen.add(key);
        entries.push({ key, value: parseValue(suffix, depth + 1) });
      }
    }

    if (items.length === 0 && entries.length === 0) {
      return fail("Expected indented members or an explicit empty collection");
    }
    return items.length > 0 ? { type: "array", items } : { type: "object", entries };
  }

  const result = parseValue(root[2]!, 1);
  if (cursor !== lines.length) {
    throw new PlainDataError("Unexpected indentation", cursor + 2);
  }
  return { concept: root[1]!, value: result };
}

export function fromJson(jsonText: string, concept = "Data"): string {
  return formatPlainData({ concept, value: parseJson(jsonText) });
}

export function toJson(plainDataText: string, indent?: string | number): string {
  const { value } = parsePlainData(plainDataText);
  return stringifyJson(value, indent);
}

export function formatPlainDataText(plainDataText: string): string {
  return formatPlainData(parsePlainData(plainDataText));
}
