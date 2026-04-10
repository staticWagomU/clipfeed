import { assertEquals, assertThrows } from "@std/assert";
import { flagsToPartialConfig } from "../cli.ts";

Deno.test("flagsToPartialConfig: returns an empty object when nothing is provided", () => {
  assertEquals(flagsToPartialConfig({}), {});
});

Deno.test("flagsToPartialConfig: passes through input / output strings verbatim", () => {
  const result = flagsToPartialConfig({ input: "./clips", output: "./out.xml" });
  assertEquals(result.input, "./clips");
  assertEquals(result.output, "./out.xml");
});

Deno.test("flagsToPartialConfig: parses --limit as a number", () => {
  const result = flagsToPartialConfig({ limit: "42" });
  assertEquals(result.limit, 42);
});

Deno.test("flagsToPartialConfig: preserves explicit --limit 0 instead of dropping it", () => {
  // The implementation uses `!== undefined` rather than a truthy check, so
  // passing `0` must survive the projection. Lock that semantic in.
  const result = flagsToPartialConfig({ limit: "0" });
  assertEquals(result.limit, 0);
});

Deno.test("flagsToPartialConfig: preserves explicit empty-string input", () => {
  // Same rationale as limit=0: an empty string is a user-provided value and
  // must not be silently dropped to the file-config layer.
  const result = flagsToPartialConfig({ input: "" });
  assertEquals("input" in result, true);
  assertEquals(result.input, "");
});

Deno.test("flagsToPartialConfig: accepts each valid --format literal", () => {
  assertEquals(flagsToPartialConfig({ format: "rss" }).format, "rss");
  assertEquals(flagsToPartialConfig({ format: "atom" }).format, "atom");
  assertEquals(flagsToPartialConfig({ format: "jsonfeed" }).format, "jsonfeed");
});

Deno.test("flagsToPartialConfig: rejects an unknown --format literal with a helpful message", () => {
  const err = assertThrows(
    () => flagsToPartialConfig({ format: "xml" }),
    Error,
  );
  // The custom `message` option on `ensure` should surface the list of valid
  // values so users can self-correct without reading source.
  assertEquals(err.message.includes("rss"), true);
});

Deno.test("flagsToPartialConfig: accepts each valid --date-source literal", () => {
  assertEquals(flagsToPartialConfig({ "date-source": "filename" }).dateSource, "filename");
  assertEquals(flagsToPartialConfig({ "date-source": "frontmatter" }).dateSource, "frontmatter");
  assertEquals(flagsToPartialConfig({ "date-source": "mtime" }).dateSource, "mtime");
});

Deno.test("flagsToPartialConfig: rejects an unknown --date-source literal", () => {
  const err = assertThrows(
    () => flagsToPartialConfig({ "date-source": "git" }),
    Error,
  );
  assertEquals(err.message.includes("filename"), true);
});

Deno.test("flagsToPartialConfig: missing flags stay absent from the result (not set to undefined)", () => {
  // mergeConfig's precedence chain depends on absent keys so the file-config
  // layer can still contribute. If this projection set keys to `undefined`
  // the `??` fallback in mergeConfig would still work, but `"key" in result`
  // would lie — guard against that regression here.
  const result = flagsToPartialConfig({ input: "./only-input" });
  assertEquals("output" in result, false);
  assertEquals("limit" in result, false);
  assertEquals("format" in result, false);
  assertEquals("dateSource" in result, false);
});
