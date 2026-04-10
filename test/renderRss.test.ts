import { assertEquals, assertStringIncludes } from "@std/assert";
import { renderRss } from "../src/renderRss.ts";
import type { FeedItem, SiteMeta } from "../src/types.ts";

const site: SiteMeta = {
  title: "wagomu's reading log",
  description: "recent clippings",
  link: "https://feed.example.com/",
  language: "ja",
};

const items: FeedItem[] = [
  {
    title: "Hello & welcome",
    link: "https://example.com/a?x=1&y=2",
    description: "first post",
    pubDate: new Date("2026-04-04T22:40:08Z"),
    guid: "20260404224008-a",
    author: "Alice",
  },
];

Deno.test("renderRss: starts with XML declaration and RSS 2.0 root", () => {
  const xml = renderRss(items, site);
  assertEquals(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), true);
  assertStringIncludes(xml, '<rss version="2.0"');
});

Deno.test("renderRss: emits channel metadata", () => {
  const xml = renderRss(items, site);
  assertStringIncludes(xml, "<title>wagomu&apos;s reading log</title>");
  assertStringIncludes(xml, "<description>recent clippings</description>");
  assertStringIncludes(xml, "<link>https://feed.example.com/</link>");
  assertStringIncludes(xml, "<language>ja</language>");
});

Deno.test("renderRss: escapes XML special characters in item title and link", () => {
  const xml = renderRss(items, site);
  assertStringIncludes(xml, "<title>Hello &amp; welcome</title>");
  assertStringIncludes(xml, "<link>https://example.com/a?x=1&amp;y=2</link>");
});

Deno.test("renderRss: uses RFC 822 pubDate and non-permalink guid", () => {
  const xml = renderRss(items, site);
  // toUTCString produces RFC 822 compatible output
  assertStringIncludes(xml, "<pubDate>Sat, 04 Apr 2026 22:40:08 GMT</pubDate>");
  assertStringIncludes(
    xml,
    '<guid isPermaLink="false">20260404224008-a</guid>',
  );
});

Deno.test("renderRss: includes atom:self link when site.link is set", () => {
  const xml = renderRss(items, site);
  assertStringIncludes(xml, 'xmlns:atom="http://www.w3.org/2005/Atom"');
  assertStringIncludes(
    xml,
    '<atom:link href="https://feed.example.com/feed.xml" rel="self" type="application/rss+xml"/>',
  );
});

Deno.test("renderRss: omits author element when author is missing", () => {
  const noAuthor: FeedItem[] = [{ ...items[0], author: undefined }];
  const xml = renderRss(noAuthor, site);
  assertEquals(xml.includes("<author>"), false);
});

Deno.test("renderRss: omits <language> element when site.language is not set", () => {
  const noLang: SiteMeta = { ...site, language: undefined };
  const xml = renderRss(items, noLang);
  assertEquals(xml.includes("<language>"), false);
});

Deno.test("renderRss: uses the injected clock for lastBuildDate so output is deterministic", () => {
  const fixedNow = new Date("2026-05-01T00:00:00Z");
  const xml = renderRss(items, site, fixedNow);
  assertStringIncludes(xml, "<lastBuildDate>Fri, 01 May 2026 00:00:00 GMT</lastBuildDate>");
});

Deno.test("renderRss: renders multiple items in input order", () => {
  const multi: FeedItem[] = [
    items[0],
    {
      title: "Second",
      link: "https://example.com/b",
      description: "second post",
      pubDate: new Date("2026-04-03T10:00:00Z"),
      guid: "20260403100000-b",
    },
  ];
  const xml = renderRss(multi, site);
  const firstIdx = xml.indexOf("20260404224008-a");
  const secondIdx = xml.indexOf("20260403100000-b");
  assertEquals(firstIdx >= 0 && secondIdx >= 0, true);
  // Input order is preserved: buildFeed is responsible for sorting upstream,
  // so renderRss must not reorder.
  assertEquals(firstIdx < secondIdx, true);
});

Deno.test("renderRss: handles an empty item list without throwing", () => {
  const xml = renderRss([], site, new Date("2026-05-01T00:00:00Z"));
  assertStringIncludes(xml, "<channel>");
  assertEquals(xml.includes("<item>"), false);
});
