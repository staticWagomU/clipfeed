/** XML-escape the 5 predefined entities. Order matters: & must come first. */
export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Join a base URL and a path segment, inserting a single slash. */
export function joinUrl(base: string, path: string): string {
  if (base.endsWith("/")) return base + path;
  return base + "/" + path;
}

/** Extract the hostname (without port) from an https://host/... URL for tag URIs etc. */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
