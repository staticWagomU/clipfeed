import { assertEquals } from "@std/assert";
import { renderJsonFeed } from "../src/renderJsonFeed.ts";
import type { FeedItem, SiteMeta } from "../src/types.ts";

const site: SiteMeta = {
  title: "wagomu's log",
  description: "recent clippings",
  link: "https://feed.example.com/",
  language: "ja",
};

const items: FeedItem[] = [
  {
    title: "Hello & welcome",
    link: "https://example.com/a",
    description: "body",
    pubDate: new Date("2026-04-04T22:40:08Z"),
    guid: "20260404224008-a",
    author: "Alice",
  },
];

Deno.test("renderJsonFeed: emits JSON Feed 1.1 top-level shape", () => {
  const parsed = JSON.parse(renderJsonFeed(items, site));
  assertEquals(parsed.version, "https://jsonfeed.org/version/1.1");
  assertEquals(parsed.title, "wagomu's log");
  assertEquals(parsed.description, "recent clippings");
  assertEquals(parsed.home_page_url, "https://feed.example.com/");
  assertEquals(parsed.feed_url, "https://feed.example.com/feed.json");
  assertEquals(parsed.language, "ja");
});

Deno.test("renderJsonFeed: items have id / url / title / date_published / content_text", () => {
  const parsed = JSON.parse(renderJsonFeed(items, site));
  assertEquals(parsed.items.length, 1);
  const item = parsed.items[0];
  // JSON does not need XML escaping, so the raw ampersand is kept
  assertEquals(item.title, "Hello & welcome");
  assertEquals(item.id, "20260404224008-a");
  assertEquals(item.url, "https://example.com/a");
  assertEquals(item.date_published, "2026-04-04T22:40:08.000Z");
  assertEquals(item.content_text, "body");
});

Deno.test("renderJsonFeed: author becomes authors array per JSON Feed 1.1", () => {
  const parsed = JSON.parse(renderJsonFeed(items, site));
  assertEquals(parsed.items[0].authors, [{ name: "Alice" }]);
});

Deno.test("renderJsonFeed: omits authors when author is absent", () => {
  const noAuthor: FeedItem[] = [{ ...items[0], author: undefined }];
  const parsed = JSON.parse(renderJsonFeed(noAuthor, site));
  assertEquals(parsed.items[0].authors, undefined);
});
