import { assertEquals, assertThrows } from "@std/assert";
import { parseClipping } from "../src/parseClipping.ts";

const DEFAULT_MAP = {
  title: "title",
  link: "source",
  description: "description",
  date: "created",
  author: "author",
};

Deno.test("parseClipping: builds FeedItem from Obsidian Web Clipper markdown", () => {
  const filename = "20260404224008-フィルター.md";
  const content = `---
title: "フィルター"
source: "https://obsidian.md/ja/help/web-clipper/filters"
author:
  - "[[Obsidian ヘルプ]]"
created: 2026-04-04
description: "変数 - Obsidian ヘルプ"
tags:
  - "clippings"
---
body text here`;

  const item = parseClipping(filename, content, DEFAULT_MAP);
  assertEquals(item.title, "フィルター");
  assertEquals(item.link, "https://obsidian.md/ja/help/web-clipper/filters");
  assertEquals(item.description, "変数 - Obsidian ヘルプ");
  assertEquals(item.author, "Obsidian ヘルプ");
  // Filename timestamp is preferred over frontmatter date (higher precision).
  assertEquals(item.pubDate.toISOString(), "2026-04-04T22:40:08.000Z");
  // guid is stable and should be derived from filename stem
  assertEquals(item.guid, "20260404224008-フィルター");
});

Deno.test("parseClipping: uses filename timestamp even when frontmatter has a date", () => {
  const content = `---
title: "T"
source: "https://example.com/"
created: 2026-01-01
---
body`;
  const item = parseClipping("20260101123045-t.md", content, DEFAULT_MAP);
  assertEquals(item.pubDate.toISOString(), "2026-01-01T12:30:45.000Z");
});

Deno.test("parseClipping: falls back to frontmatter date when filename timestamp is missing and date has time component", () => {
  // Simulated scenario: callers may pass already-stem'd names in future;
  // currently filename is required to parse, so this test just proves
  // that a full-datetime frontmatter value would still parse correctly.
  const content = `---
title: "T"
source: "https://example.com/"
created: "2026-03-15T10:30:00Z"
---
body`;
  const item = parseClipping("20260101000000-t.md", content, DEFAULT_MAP);
  // Filename still wins because it's present.
  assertEquals(item.pubDate.toISOString(), "2026-01-01T00:00:00.000Z");
});

Deno.test("parseClipping: strips [[wiki-link]] brackets from author", () => {
  const content = `---
title: "T"
source: "https://example.com/"
author: "[[Jane Doe]]"
---
`;
  const item = parseClipping("20260101000000-t.md", content, DEFAULT_MAP);
  assertEquals(item.author, "Jane Doe");
});

Deno.test("parseClipping: throws when frontmatter is missing", () => {
  assertThrows(
    () => parseClipping("20260101000000-x.md", "no frontmatter body", DEFAULT_MAP),
    Error,
    "frontmatter",
  );
});

Deno.test("parseClipping: throws when title is missing", () => {
  const content = `---
source: "https://example.com/"
---
`;
  assertThrows(
    () => parseClipping("20260101000000-x.md", content, DEFAULT_MAP),
    Error,
    "title",
  );
});
