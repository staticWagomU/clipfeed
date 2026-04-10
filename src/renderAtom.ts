import type { FeedItem, SiteMeta } from "./types.ts";
import { hostnameOf, joinUrl, xmlEscape } from "./xml.ts";

/**
 * Render a list of FeedItems as an Atom 1.0 feed (RFC 4287).
 *
 * - updated / published are ISO 8601.
 * - entry <id> uses the tag: URI scheme (RFC 4151) so guids don't need to be URLs.
 * - feed <id> uses the site.link as a URI.
 *
 * `now` is injectable so tests can assert on the feed-level `<updated>` value
 * deterministically when the item list is empty. Production callers omit it.
 */
export function renderAtom(
  items: readonly FeedItem[],
  site: SiteMeta,
  now: Date = new Date(),
): string {
  const selfHref = joinUrl(site.link, "feed.xml");
  const host = hostnameOf(site.link);
  const latest = items.at(0)?.pubDate ?? now;

  const entryXml = items.map((i) => renderEntry(i, host)).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"${
    site.language ? ` xml:lang="${xmlEscape(site.language)}"` : ""
  }>
  <title>${xmlEscape(site.title)}</title>
  <subtitle>${xmlEscape(site.description)}</subtitle>
  <id>${xmlEscape(site.link)}</id>
  <link rel="self" href="${xmlEscape(selfHref)}" type="application/atom+xml"/>
  <link rel="alternate" href="${xmlEscape(site.link)}" type="text/html"/>
  <updated>${latest.toISOString()}</updated>
${entryXml}
</feed>
`;
}

function renderEntry(item: FeedItem, host: string): string {
  const year = item.pubDate.getUTCFullYear();
  const id = `tag:${host},${year}:${item.guid}`;
  const parts: string[] = [
    "  <entry>",
    `    <title>${xmlEscape(item.title)}</title>`,
    `    <id>${xmlEscape(id)}</id>`,
    `    <link rel="alternate" href="${xmlEscape(item.link)}"/>`,
    `    <published>${item.pubDate.toISOString()}</published>`,
    `    <updated>${item.pubDate.toISOString()}</updated>`,
    `    <summary>${xmlEscape(item.description)}</summary>`,
  ];
  if (item.author) {
    parts.push(`    <author><name>${xmlEscape(item.author)}</name></author>`);
  }
  parts.push("  </entry>");
  return parts.join("\n");
}
