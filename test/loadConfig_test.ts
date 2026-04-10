import { assertEquals } from "@std/assert";
import { DEFAULT_CONFIG, expandHome, mergeConfig } from "../src/config.ts";

Deno.test("mergeConfig: returns defaults when nothing is provided", () => {
  const result = mergeConfig(undefined, {});
  assertEquals(result.limit, 5);
  assertEquals(result.output, "./feed.xml");
  assertEquals(result.frontmatter.title, "title");
  assertEquals(result.frontmatter.link, "source");
  assertEquals(result.frontmatter.date, "created");
});

Deno.test("mergeConfig: file config overrides defaults", () => {
  const file = {
    input: "./clips",
    limit: 20,
    site: { title: "My Feed", description: "d", link: "https://example.com/" },
  };
  const result = mergeConfig(file, {});
  assertEquals(result.input, "./clips");
  assertEquals(result.limit, 20);
  assertEquals(result.site.title, "My Feed");
});

Deno.test("mergeConfig: CLI flags override file config", () => {
  const file = {
    input: "./clips",
    limit: 20,
    site: { title: "File Title", description: "d", link: "https://example.com/" },
  };
  const cli = { limit: 3, input: "./other" };
  const result = mergeConfig(file, cli);
  assertEquals(result.limit, 3);
  assertEquals(result.input, "./other");
  // site.title still comes from file since CLI did not touch it
  assertEquals(result.site.title, "File Title");
});

Deno.test("mergeConfig: deep-merges frontmatter map one level", () => {
  const file = {
    frontmatter: { title: "custom_title" },
  };
  const result = mergeConfig(file, {});
  assertEquals(result.frontmatter.title, "custom_title");
  // untouched keys keep defaults
  assertEquals(result.frontmatter.link, "source");
});

Deno.test("expandHome: replaces leading ~ with $HOME", () => {
  const home = "/Users/test";
  assertEquals(expandHome("~/MyLife/Clippings", home), "/Users/test/MyLife/Clippings");
  assertEquals(expandHome("/absolute/path", home), "/absolute/path");
  assertEquals(expandHome("./relative", home), "./relative");
});

Deno.test("DEFAULT_CONFIG: has sensible defaults", () => {
  assertEquals(DEFAULT_CONFIG.limit, 5);
  assertEquals(DEFAULT_CONFIG.output, "./feed.xml");
});
