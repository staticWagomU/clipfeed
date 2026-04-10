import type { FeedItem, SiteMeta } from "./types.ts";
import { joinUrl, xmlEscape } from "./xml.ts";

/**
 * Render a list of FeedItems as RSS 2.0 XML.
 *
 * - pubDate is serialized in RFC 822 format (required by RSS 2.0).
 * - All text nodes and attribute values are XML-escaped.
 * - guid is emitted with isPermaLink="false" because we use the filename stem,
 *   not a resolvable URL, as the stable identifier.
 */
export function renderRss(items: readonly FeedItem[], site: SiteMeta): string {
  const selfHref = joinUrl(site.link, "feed.xml");
  const now = new Date();

  const itemXml = items.map((item) => renderItem(item)).join("\n");
  // Optional element: emit a fully-formed line (with trailing newline) when
  // present, empty string otherwise. Building it outside the template keeps
  // the main literal's indentation readable instead of splicing a ternary
  // inline between `<description>` and `<lastBuildDate>`.
  const languageLine = site.language
    ? `    <language>${xmlEscape(site.language)}</language>\n`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(site.title)}</title>
    <link>${xmlEscape(site.link)}</link>
    <description>${xmlEscape(site.description)}</description>
${languageLine}    <lastBuildDate>${now.toUTCString()}</lastBuildDate>
    <atom:link href="${xmlEscape(selfHref)}" rel="self" type="application/rss+xml"/>
${itemXml}
  </channel>
</rss>
`;
}

function renderItem(item: FeedItem): string {
  const parts: string[] = [
    "    <item>",
    `      <title>${xmlEscape(item.title)}</title>`,
    `      <link>${xmlEscape(item.link)}</link>`,
    `      <description>${xmlEscape(item.description)}</description>`,
    `      <pubDate>${item.pubDate.toUTCString()}</pubDate>`,
    `      <guid isPermaLink="false">${xmlEscape(item.guid)}</guid>`,
  ];
  if (item.author) {
    parts.push(`      <author>${xmlEscape(item.author)}</author>`);
  }
  parts.push("    </item>");
  return parts.join("\n");
}
