import { assertEquals } from "@std/assert";
import { buildFeed } from "../src/buildFeed.ts";
import type { FeedItem } from "../src/types.ts";

function mkItem(guid: string, iso: string): FeedItem {
  return {
    title: guid,
    link: `https://example.com/${guid}`,
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
