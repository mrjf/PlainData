import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatPlainData,
  formatPlainDataText,
  fromJson,
  parseJson,
  parsePlainData,
  PlainDataError,
  toJson,
} from "../src/index.js";

describe("PlainData", () => {
  it("round-trips nested objects, arrays, and scalars losslessly", () => {
    const json = JSON.stringify({
      theme: "dark",
      fontSize: 14,
      enabled: true,
      note: null,
      tags: ["work", "urgent"],
      nested: { a: [1, 2, { deep: false }], emptyArr: [], emptyObj: {} },
    });

    const plain = fromJson(json, "DisplaySettings");
    const parsed = parsePlainData(plain);
    assert.equal(parsed.concept, "DisplaySettings");
    assert.deepEqual(parsed.value, parseJson(json));
    assert.equal(formatPlainData(parsed), plain);
    assert.equal(toJson(plain), json);
  });

  it("preserves exact raw number spelling and member order", () => {
    const rawJson = '{"z":1.50,"a":1e400,"neg":-0.0,"big":123456789012345678901234567890}';
    const plain = fromJson(rawJson, "ExactNumbers");
    assert.match(plain, /- z - 1\.50/);
    assert.match(plain, /- a - 1e400/);
    assert.match(plain, /- neg - -0\.0/);
    assert.match(plain, /- big - 123456789012345678901234567890/);
    assert.equal(toJson(plain), rawJson);
  });

  it("quotes non-identifier object keys and round-trips them", () => {
    const rawJson = '{"normal_key":1,"with space":2,"#1":3,"a:b":4,"":5}';
    const plain = fromJson(rawJson, "SpecialKeys");
    assert.match(plain, /- normal_key - 1/);
    assert.match(plain, /- "with space" - 2/);
    assert.match(plain, /- "#1" - 3/);
    assert.match(plain, /- "a:b" - 4/);
    assert.match(plain, /- "" - 5/);
    assert.equal(toJson(plain), rawJson);
  });

  it("supports scalar and empty collection roots", () => {
    for (const raw of ["null", "true", "42", '"hello"', "[]", "{}"]) {
      const plain = fromJson(raw, "Root");
      assert.equal(toJson(plain), raw);
      assert.equal(formatPlainDataText(plain), plain);
    }
  });

  it("rejects invalid syntax, duplicate keys, non-consecutive arrays, and inline nonempty collections", () => {
    assert.throws(() => parsePlainData("not-header\n- :A: - 1\n"), PlainDataError);
    assert.throws(() => parsePlainData("***plaindata***\n- :123: - 1\n"), PlainDataError);
    assert.throws(
      () => parsePlainData("***plaindata***\n- :A:\n  - x - 1\n  - x - 2\n"),
      /duplicate member/i,
    );
    assert.throws(
      () => parsePlainData("***plaindata***\n- :A:\n  - #1 - 1\n  - #3 - 2\n"),
      /consecutive array/i,
    );
    assert.throws(
      () => parsePlainData("***plaindata***\n- :A: - [1,2]\n"),
      /indented members/i,
    );
    assert.throws(
      () => parsePlainData("***plaindata***\n- :A:\n  - x - 1\n  - #1 - 2\n"),
      /consecutive array|Mixed collection/i,
    );
  });
});
