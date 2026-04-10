import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { expandHome, loadConfigFile, mergeConfig } from "../src/config.ts";

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

Deno.test("expandHome: replaces leading ~/ with the given home directory", () => {
  assertEquals(expandHome("~/MyLife/Clippings", "/Users/test"), "/Users/test/MyLife/Clippings");
});

Deno.test("expandHome: maps a bare ~ to the home directory itself", () => {
  // The function has a dedicated branch for exact `~` (no trailing slash);
  // cover it so regressions that collapse it into the `~/` case are caught.
  assertEquals(expandHome("~", "/Users/test"), "/Users/test");
});

Deno.test("expandHome: leaves absolute paths untouched", () => {
  assertEquals(expandHome("/absolute/path", "/Users/test"), "/absolute/path");
});

Deno.test("expandHome: leaves relative paths untouched", () => {
  assertEquals(expandHome("./relative", "/Users/test"), "./relative");
});

Deno.test("expandHome: leaves ~user (different user) untouched — we only handle current user's home", () => {
  // ~otheruser is not the current user's home and expandHome intentionally
  // ignores it. Document that contract so nobody "fixes" it later.
  assertEquals(expandHome("~otheruser/file", "/Users/test"), "~otheruser/file");
});

Deno.test("mergeConfig: deep-merges the site map so a single CLI override keeps untouched keys", () => {
  // Companion to the frontmatter deep-merge test above; covers the site
  // branch of mergeConfig's manual deep-merge so a future refactor that
  // swaps object spread for, say, Object.assign cannot silently clobber
  // untouched fields.
  const file = {
    site: { title: "File Title", description: "desc", link: "https://example.com/" },
  };
  const cli = { site: { title: "CLI Title" } };
  const result = mergeConfig(file, cli);
  assertEquals(result.site.title, "CLI Title");
  assertEquals(result.site.description, "desc");
  assertEquals(result.site.link, "https://example.com/");
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
