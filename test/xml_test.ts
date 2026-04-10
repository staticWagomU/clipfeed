import { assertEquals } from "@std/assert";
import { hostnameOf, joinUrl, xmlEscape } from "../src/xml.ts";

Deno.test("xmlEscape: replaces the five predefined XML entities", () => {
  assertEquals(xmlEscape("&"), "&amp;");
  assertEquals(xmlEscape("<"), "&lt;");
  assertEquals(xmlEscape(">"), "&gt;");
  assertEquals(xmlEscape('"'), "&quot;");
  assertEquals(xmlEscape("'"), "&apos;");
});

Deno.test("xmlEscape: ampersand is escaped first so earlier replacements do not get re-escaped", () => {
  // If `<` were escaped before `&`, the resulting `&lt;` would be turned into
  // `&amp;lt;` on the `&` pass. The function documents that order matters;
  // this test locks that invariant in so refactors cannot silently break it.
  assertEquals(xmlEscape("<&>"), "&lt;&amp;&gt;");
});

Deno.test("xmlEscape: handles mixed content with multiple entities", () => {
  assertEquals(
    xmlEscape(`Tom & Jerry's <"friends">`),
    "Tom &amp; Jerry&apos;s &lt;&quot;friends&quot;&gt;",
  );
});

Deno.test("xmlEscape: passes through plain ASCII and non-ASCII unchanged", () => {
  assertEquals(xmlEscape("hello world"), "hello world");
  assertEquals(xmlEscape("フィルター"), "フィルター");
});

Deno.test("xmlEscape: empty string stays empty", () => {
  assertEquals(xmlEscape(""), "");
});

Deno.test("joinUrl: inserts a single slash when base has no trailing slash", () => {
  assertEquals(joinUrl("https://example.com", "feed.xml"), "https://example.com/feed.xml");
});

Deno.test("joinUrl: does not double up slashes when base already ends with one", () => {
  assertEquals(joinUrl("https://example.com/", "feed.xml"), "https://example.com/feed.xml");
});

Deno.test("joinUrl: preserves sub-path segments", () => {
  assertEquals(
    joinUrl("https://example.com/blog", "feed.xml"),
    "https://example.com/blog/feed.xml",
  );
  assertEquals(
    joinUrl("https://example.com/blog/", "feed.xml"),
    "https://example.com/blog/feed.xml",
  );
});

Deno.test("hostnameOf: extracts the hostname from a well-formed URL", () => {
  assertEquals(hostnameOf("https://feed.example.com/blog"), "feed.example.com");
});

Deno.test("hostnameOf: drops the port component", () => {
  assertEquals(hostnameOf("http://localhost:9000/path"), "localhost");
});

Deno.test("hostnameOf: falls back to the raw input when URL parsing fails", () => {
  // Used for tag: URI construction; we'd rather produce a stable value than throw.
  assertEquals(hostnameOf("not-a-url"), "not-a-url");
});
