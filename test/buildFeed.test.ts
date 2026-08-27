import { assertEquals } from "@std/assert";
import { buildFeed } from "../src/buildFeed.ts";
import type { FeedItem } from "../src/types.ts";

function mkItem(guid: string, iso: string, link?: string): FeedItem {
  return {
    title: guid,
    link: link ?? `https://example.com/${guid}`,
    description: "",
    pubDate: new Date(iso),
    guid,
  };
}

Deno.test("buildFeed: sorts items by pubDate descending", () => {
  const items = [
    mkItem("a", "2026-01-01T00:00:00Z"),
    mkItem("b", "2026-03-01T00:00:00Z"),
    mkItem("c", "2026-02-01T00:00:00Z"),
  ];
  const result = buildFeed(items, 10);
  assertEquals(result.map((i) => i.guid), ["b", "c", "a"]);
});

Deno.test("buildFeed: limits result length", () => {
  const items = [
    mkItem("a", "2026-01-01T00:00:00Z"),
    mkItem("b", "2026-02-01T00:00:00Z"),
    mkItem("c", "2026-03-01T00:00:00Z"),
  ];
  const result = buildFeed(items, 2);
  assertEquals(result.length, 2);
  assertEquals(result.map((i) => i.guid), ["c", "b"]);
});

Deno.test("buildFeed: does not mutate input", () => {
  const items = [
    mkItem("a", "2026-01-01T00:00:00Z"),
    mkItem("b", "2026-02-01T00:00:00Z"),
  ];
  const before = items.map((i) => i.guid).join(",");
  buildFeed(items, 10);
  assertEquals(items.map((i) => i.guid).join(","), before);
});

Deno.test("buildFeed: breaks ties by guid ascending for deterministic output", () => {
  const same = "2026-01-01T00:00:00Z";
  const items = [
    mkItem("c", same),
    mkItem("a", same),
    mkItem("b", same),
  ];
  const result = buildFeed(items, 10);
  assertEquals(result.map((i) => i.guid), ["a", "b", "c"]);
});

Deno.test("buildFeed: returns an empty array when given no items", () => {
  assertEquals(buildFeed([], 10), []);
});

Deno.test("buildFeed: returns all items when limit exceeds input length", () => {
  const items = [
    mkItem("a", "2026-01-01T00:00:00Z"),
    mkItem("b", "2026-02-01T00:00:00Z"),
  ];
  const result = buildFeed(items, 100);
  assertEquals(result.length, 2);
  assertEquals(result.map((i) => i.guid), ["b", "a"]);
});

Deno.test("buildFeed: limit of 0 returns an empty array", () => {
  const items = [
    mkItem("a", "2026-01-01T00:00:00Z"),
    mkItem("b", "2026-02-01T00:00:00Z"),
  ];
  assertEquals(buildFeed(items, 0), []);
});

Deno.test("buildFeed: single-item input is returned as-is", () => {
  const items = [mkItem("only", "2026-01-01T00:00:00Z")];
  const result = buildFeed(items, 5);
  assertEquals(result.map((i) => i.guid), ["only"]);
});

Deno.test("buildFeed: collapses items sharing a link, keeping the newest", () => {
  const items = [
    mkItem("old", "2026-01-01T00:00:00Z", "https://example.com/article"),
    mkItem("new", "2026-03-01T00:00:00Z", "https://example.com/article"),
    mkItem("other", "2026-02-01T00:00:00Z", "https://example.com/other"),
  ];
  const result = buildFeed(items, 10);
  assertEquals(result.map((i) => i.guid), ["new", "other"]);
});

Deno.test("buildFeed: dedupes by link before applying the limit", () => {
  const items = [
    mkItem("dup-new", "2026-04-01T00:00:00Z", "https://example.com/a"),
    mkItem("dup-old", "2026-03-01T00:00:00Z", "https://example.com/a"),
    mkItem("b", "2026-02-01T00:00:00Z", "https://example.com/b"),
  ];
  // Without dedup, the two newest items are both copies of /a and limit 2
  // would emit ["dup-new", "dup-old"]. Dedup-before-limit must instead free
  // the slot for the genuinely distinct /b.
  const result = buildFeed(items, 2);
  assertEquals(result.map((i) => i.guid), ["dup-new", "b"]);
});

Deno.test("buildFeed: keeps items with empty links distinct", () => {
  const items = [
    mkItem("x", "2026-01-01T00:00:00Z", ""),
    mkItem("y", "2026-02-01T00:00:00Z", ""),
  ];
  const result = buildFeed(items, 10);
  assertEquals(result.map((i) => i.guid), ["y", "x"]);
});
