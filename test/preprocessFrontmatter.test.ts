import { assertEquals, assertStringIncludes } from "@std/assert";
import { preprocessFrontmatter } from "../src/preprocessFrontmatter.ts";

Deno.test("preprocessFrontmatter: wraps unquoted value containing ' #' in single quotes so YAML keeps it literal", () => {
  const input = `title: Recipe # yields 4 servings
source: "https://example.com/"`;
  const output = preprocessFrontmatter(input);
  assertStringIncludes(output, `title: 'Recipe # yields 4 servings'`);
  // lines without a comment marker are untouched
  assertStringIncludes(output, `source: "https://example.com/"`);
});

Deno.test("preprocessFrontmatter: leaves already double-quoted values alone", () => {
  const input = `title: "Already # safe"`;
  assertEquals(preprocessFrontmatter(input), input);
});

Deno.test("preprocessFrontmatter: leaves already single-quoted values alone", () => {
  const input = `title: 'Already # safe'`;
  assertEquals(preprocessFrontmatter(input), input);
});

Deno.test("preprocessFrontmatter: escapes embedded single quotes by doubling when wrapping", () => {
  const input = `title: It's a # thing`;
  const output = preprocessFrontmatter(input);
  assertStringIncludes(output, `title: 'It''s a # thing'`);
});

Deno.test("preprocessFrontmatter: leaves values without a comment marker untouched", () => {
  const input = `title: Hello world
author: Jane Doe
created: 2026-04-01`;
  assertEquals(preprocessFrontmatter(input), input);
});

Deno.test("preprocessFrontmatter: does not touch URLs that contain '#' without preceding whitespace (not a YAML comment)", () => {
  // https://example.com/page#section has no space before '#', so YAML already
  // parses it correctly. We must not accidentally rewrite it.
  const input = `source: https://example.com/page#section`;
  assertEquals(preprocessFrontmatter(input), input);
});

Deno.test("preprocessFrontmatter: ignores block indicators, flow collections, and anchor tokens", () => {
  const input = `block: |
  raw # literal
flow: [a, b]
anchor: &id
tagged: !!str`;
  assertEquals(preprocessFrontmatter(input), input);
});

Deno.test("preprocessFrontmatter: does not touch list item lines (no key before colon)", () => {
  // The key:value detector should not fire on bare list items. Whether YAML
  // interprets a hash in a list item as a comment is outside our scope.
  const input = `tags:
  - clippings
  - tech`;
  assertEquals(preprocessFrontmatter(input), input);
});
