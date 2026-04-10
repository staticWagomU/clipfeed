export type ParsedFilename = {
  timestamp: Date;
  slug: string;
  /** Filename without the .md extension; stable identifier for a clipping. */
  stem: string;
};

const PREFIX_RE = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})-(.*)$/;

/**
 * Parse a clipping filename of the form `YYYYMMDDHHmmss-<slug>.md`.
 * The timestamp portion is interpreted as UTC.
 */
export function parseFilename(filename: string): ParsedFilename {
  const stem = filename.replace(/\.md$/, "");
  const match = PREFIX_RE.exec(stem);
  if (!match) {
    throw new Error(`parseFilename: missing YYYYMMDDHHmmss timestamp prefix in "${filename}"`);
  }
  const [, y, mo, d, h, mi, s, slug] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s);

  // Validate component ranges before constructing the Date, because
  // Date.UTC silently wraps out-of-range values (e.g. month=13 -> next year).
  if (
    month < 1 || month > 12 ||
    day < 1 || day > 31 ||
    hour > 23 || minute > 59 || second > 59
  ) {
    throw new Error(`parseFilename: invalid date components in "${filename}"`);
  }

  const ms = Date.UTC(year, month - 1, day, hour, minute, second);
  const timestamp = new Date(ms);

  // Reject dates that JS silently normalized (e.g. Feb 30 -> Mar 2).
  if (
    timestamp.getUTCFullYear() !== year ||
    timestamp.getUTCMonth() !== month - 1 ||
    timestamp.getUTCDate() !== day
  ) {
    throw new Error(`parseFilename: invalid date in "${filename}"`);
  }

  return { timestamp, slug, stem };
}
