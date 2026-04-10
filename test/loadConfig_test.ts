import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { DEFAULT_CONFIG, expandHome, loadConfigFile, mergeConfig } from "../src/config.ts";

/**
 * Write `body` to a fresh temp file and return its path. Caller is responsible
 * for cleanup via `Deno.remove`. Keeping this helper local to the test file
 * avoids pulling in a shared fixture module just for a handful of cases.
 */
async function writeTempConfig(body: string): Promise<string> {
  const path = await Deno.makeTempFile({ prefix: "clipfeed-cfg-", suffix: ".json" });
  await Deno.writeTextFile(path, body);
  return path;
}

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

Deno.test("mergeConfig: picks ./feed.atom.xml as the default output when format is atom", () => {
  const result = mergeConfig(undefined, { format: "atom" });
  assertEquals(result.output, "./feed.atom.xml");
});

Deno.test("mergeConfig: picks ./feed.json as the default output when format is jsonfeed", () => {
  const result = mergeConfig(undefined, { format: "jsonfeed" });
  assertEquals(result.output, "./feed.json");
});

Deno.test("mergeConfig: format from file config selects the matching default output", () => {
  const result = mergeConfig({ format: "atom" }, {});
  assertEquals(result.output, "./feed.atom.xml");
});

Deno.test("mergeConfig: an explicit CLI output overrides the format-based default", () => {
  const result = mergeConfig(undefined, { format: "atom", output: "./custom.xml" });
  assertEquals(result.output, "./custom.xml");
});

Deno.test("mergeConfig: an explicit file output overrides the format-based default", () => {
  const result = mergeConfig({ format: "jsonfeed", output: "./legacy.xml" }, {});
  assertEquals(result.output, "./legacy.xml");
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

Deno.test("loadConfigFile: returns undefined when no path is given", async () => {
  assertEquals(await loadConfigFile(undefined), undefined);
  assertEquals(await loadConfigFile(""), undefined);
});

Deno.test("loadConfigFile: parses a valid config file", async () => {
  const path = await writeTempConfig(JSON.stringify({
    input: "./clips",
    limit: 7,
    format: "atom",
    dateSource: "frontmatter",
    site: { title: "t", description: "d", link: "https://example.com/" },
  }));
  try {
    const cfg = await loadConfigFile(path);
    assertEquals(cfg?.input, "./clips");
    assertEquals(cfg?.limit, 7);
    assertEquals(cfg?.format, "atom");
    assertEquals(cfg?.dateSource, "frontmatter");
    assertEquals(cfg?.site?.title, "t");
  } finally {
    await Deno.remove(path);
  }
});

Deno.test("loadConfigFile: accepts a fully valid upload block", async () => {
  const path = await writeTempConfig(JSON.stringify({
    upload: {
      type: "s3",
      endpoint: "r2.example.com",
      region: "auto",
      bucket: "b",
      objectKey: "feed.xml",
      useSSL: true,
    },
  }));
  try {
    const cfg = await loadConfigFile(path);
    assertEquals(cfg?.upload?.type, "s3");
    assertEquals(cfg?.upload?.bucket, "b");
    assertEquals(cfg?.upload?.useSSL, true);
  } finally {
    await Deno.remove(path);
  }
});

Deno.test("loadConfigFile: rejects an unknown format literal", async () => {
  const path = await writeTempConfig(JSON.stringify({ format: "xml" }));
  try {
    const err = await assertRejects(() => loadConfigFile(path), Error);
    // The custom `message` option passed to `ensure` must surface the path so
    // the user can tell which file to fix.
    assertStringIncludes(err.message, path);
  } finally {
    await Deno.remove(path);
  }
});

Deno.test("loadConfigFile: rejects a wrong-typed limit", async () => {
  const path = await writeTempConfig(JSON.stringify({ limit: "five" }));
  try {
    const err = await assertRejects(() => loadConfigFile(path), Error);
    assertStringIncludes(err.message, path);
  } finally {
    await Deno.remove(path);
  }
});

Deno.test("loadConfigFile: rejects an upload block missing required fields", async () => {
  // `endpoint`, `region`, `objectKey` are required on UploadConfig.
  const path = await writeTempConfig(JSON.stringify({
    upload: { type: "s3", bucket: "b" },
  }));
  try {
    const err = await assertRejects(() => loadConfigFile(path), Error);
    assertStringIncludes(err.message, path);
  } finally {
    await Deno.remove(path);
  }
});
