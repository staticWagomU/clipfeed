import { assertEquals, assertThrows } from "@std/assert";
import { parseFilename } from "../src/parseFilename.ts";

Deno.test("parseFilename: extracts UTC timestamp and slug from YYYYMMDDHHmmss prefix", () => {
  const result = parseFilename("20260404224008-フィルター.md");
  assertEquals(result.timestamp.toISOString(), "2026-04-04T22:40:08.000Z");
  assertEquals(result.slug, "フィルター");
});

Deno.test("parseFilename: strips .md extension from slug", () => {
  const result = parseFilename("20260407053440-New CSS Multi-Column Layout Features in Chrome.md");
  assertEquals(result.slug, "New CSS Multi-Column Layout Features in Chrome");
});

Deno.test("parseFilename: handles filenames without extension", () => {
  const result = parseFilename("20260101000000-hello");
  assertEquals(result.slug, "hello");
  assertEquals(result.timestamp.toISOString(), "2026-01-01T00:00:00.000Z");
});

Deno.test("parseFilename: throws on missing 14-digit prefix", () => {
  assertThrows(
    () => parseFilename("not-a-timestamped-file.md"),
    Error,
    "timestamp prefix",
  );
});

Deno.test("parseFilename: throws on invalid date components", () => {
  // month 13 is invalid
  assertThrows(
    () => parseFilename("20261301000000-bogus.md"),
    Error,
    "invalid date",
  );
});

Deno.test("parseFilename: rejects Feb 30 instead of silently wrapping to March", () => {
  // Date.UTC(2026, 1, 30) silently normalizes to 2026-03-02, which would
  // publish an item on the wrong day. The roundtrip check in parseFilename
  // exists specifically to catch this; lock the behavior in.
  assertThrows(
    () => parseFilename("20260230000000-leapish.md"),
    Error,
    "invalid date",
  );
});

Deno.test("parseFilename: rejects out-of-range hour", () => {
  assertThrows(
    () => parseFilename("20260101250000-bad.md"),
    Error,
    "invalid date",
  );
});

Deno.test("parseFilename: accepts maximum legal components 23:59:59", () => {
  const result = parseFilename("20260101235959-max.md");
  assertEquals(result.timestamp.toISOString(), "2026-01-01T23:59:59.000Z");
});

Deno.test("parseFilename: stem is the filename without extension", () => {
  const result = parseFilename("20260404224008-slug.md");
  assertEquals(result.stem, "20260404224008-slug");
});
