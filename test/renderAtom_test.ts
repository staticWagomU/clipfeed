import { assertEquals, assertStringIncludes } from "@std/assert";
import { renderAtom } from "../src/renderAtom.ts";
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

Deno.test("renderAtom: starts with XML declaration and Atom 1.0 feed element", () => {
  const xml = renderAtom(items, site);
  assertEquals(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), true);
  assertStringIncludes(xml, '<feed xmlns="http://www.w3.org/2005/Atom"');
});

Deno.test("renderAtom: emits ISO 8601 updated timestamps on entries", () => {
  const xml = renderAtom(items, site);
  assertStringIncludes(xml, "<updated>2026-04-04T22:40:08.000Z</updated>");
  assertStringIncludes(xml, "<published>2026-04-04T22:40:08.000Z</published>");
});

Deno.test("renderAtom: uses tag URI for entry id and escapes title", () => {
  const xml = renderAtom(items, site);
  assertStringIncludes(xml, "<title>Hello &amp; welcome</title>");
  assertStringIncludes(xml, "<id>tag:feed.example.com,2026:20260404224008-a</id>");
});

Deno.test("renderAtom: emits self link and alternate link", () => {
  const xml = renderAtom(items, site);
  assertStringIncludes(xml, '<link rel="self" href="https://feed.example.com/feed.xml"');
  assertStringIncludes(xml, '<link rel="alternate" href="https://feed.example.com/"');
});

Deno.test("renderAtom: author element wraps name in <name>", () => {
  const xml = renderAtom(items, site);
  assertStringIncludes(xml, "<author><name>Alice</name></author>");
});
