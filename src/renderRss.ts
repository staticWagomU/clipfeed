import type { FeedItem, SiteMeta } from "./types.ts";

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

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(site.title)}</title>
    <link>${xmlEscape(site.link)}</link>
    <description>${xmlEscape(site.description)}</description>
${
    site.language
      ? `    <language>${xmlEscape(site.language)}</language>\n`
      : ""
  }    <lastBuildDate>${now.toUTCString()}</lastBuildDate>
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

function xmlEscape(s: string): string {
  // Order matters: escape & first so we don't double-escape the entities we emit.
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function joinUrl(base: string, path: string): string {
  if (base.endsWith("/")) return base + path;
  return base + "/" + path;
}
