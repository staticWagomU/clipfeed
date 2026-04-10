import { assertEquals, assertThrows } from "@std/assert";
import { resolveDate } from "../src/resolveDate.ts";

const filenameTs = new Date("2026-04-04T22:40:08Z");
const fmDate = new Date("2026-03-01T12:00:00Z");
const mtime = new Date("2026-01-15T00:00:00Z");

Deno.test("resolveDate: filename strategy picks filename timestamp", () => {
  const result = resolveDate("filename", {
    filenameTimestamp: filenameTs,
    frontmatterDate: fmDate,
    mtime,
  });
  assertEquals(result.toISOString(), filenameTs.toISOString());
});

Deno.test("resolveDate: frontmatter strategy picks frontmatter date", () => {
  const result = resolveDate("frontmatter", {
    filenameTimestamp: filenameTs,
    frontmatterDate: fmDate,
    mtime,
  });
  assertEquals(result.toISOString(), fmDate.toISOString());
});

Deno.test("resolveDate: mtime strategy picks file mtime", () => {
  const result = resolveDate("mtime", {
    filenameTimestamp: filenameTs,
    frontmatterDate: fmDate,
    mtime,
  });
  assertEquals(result.toISOString(), mtime.toISOString());
});

Deno.test("resolveDate: frontmatter strategy falls back to filename if frontmatter date missing", () => {
  const result = resolveDate("frontmatter", {
    filenameTimestamp: filenameTs,
    frontmatterDate: undefined,
    mtime,
  });
  assertEquals(result.toISOString(), filenameTs.toISOString());
});

Deno.test("resolveDate: mtime strategy throws if mtime missing", () => {
  assertThrows(
    () =>
      resolveDate("mtime", {
        filenameTimestamp: filenameTs,
        frontmatterDate: undefined,
        mtime: undefined,
      }),
    Error,
    "mtime",
  );
});

Deno.test("resolveDate: filename strategy throws if filename timestamp missing", () => {
  assertThrows(
    () =>
      resolveDate("filename", {
        filenameTimestamp: undefined,
        frontmatterDate: fmDate,
        mtime,
      }),
    Error,
    "filename timestamp",
  );
});
