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
