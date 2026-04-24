import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { parse as parseYaml } from "@std/yaml";
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

Deno.test("preprocessFrontmatter: rewrites invalid double-quote escapes so strict YAML parses them as literal backslash + char", () => {
  // Obsidian Web Clipper wraps page text in double quotes without re-escaping
  // backslashes. `\#` is not a valid YAML 1.2 escape and a strict parser
  // rejects the whole frontmatter. Confirm both that the raw input fails,
  // and that our preprocessor produces YAML the parser accepts with the
  // literal `\#` preserved as authored.
  const raw = 'title: "YouTube「\\#ch789」"';
  assertThrows(() => parseYaml(raw));
  const output = preprocessFrontmatter(raw);
  const parsed = parseYaml(output) as Record<string, unknown>;
  assertEquals(parsed.title, "YouTube「\\#ch789」");
});

Deno.test("preprocessFrontmatter: leaves valid YAML 1.2 escape sequences byte-identical", () => {
  // \n \t \\ \" \/ \xHH \uHHHH are all well-formed — touching them would
  // corrupt the author's intent.
  const input = [
    'newline: "line1\\nline2"',
    'path: "C:\\\\Users"',
    'quote: "say \\"hi\\""',
    'slash: "a\\/b"',
    'hex: "\\x41"',
    'uni: "\\u0041"',
  ].join("\n");
  assertEquals(preprocessFrontmatter(input), input);
});

Deno.test("preprocessFrontmatter: does not touch backslashes inside single-quoted scalars (escape rules do not apply there)", () => {
  // In single-quoted YAML, backslashes are literal — no escape normalization
  // is needed, and rewriting would change the value.
  const input = "title: 'raw \\# literal'";
  assertEquals(preprocessFrontmatter(input), input);
});

Deno.test("preprocessFrontmatter: tracks escaped double-quote without prematurely leaving in-string state", () => {
  // The \" in the middle is a YAML-legal escape; the scanner must NOT treat
  // it as a closing delimiter, otherwise the following \# would be seen as
  // outside a string and left unfixed.
  const raw = 'title: "say \\"hi\\" then \\#tag"';
  const output = preprocessFrontmatter(raw);
  const parsed = parseYaml(output) as Record<string, unknown>;
  assertEquals(parsed.title, 'say "hi" then \\#tag');
});
