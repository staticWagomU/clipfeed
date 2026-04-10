/**
 * Pre-process a raw YAML frontmatter body to survive unquoted `#` characters.
 *
 * Background: in YAML, an unquoted scalar ending with ` # ...` is parsed as
 * just the text *before* ` #` — the rest is a line comment. Obsidian Web
 * Clipper occasionally emits values like `title: Recipe # 4 servings` when a
 * page title contains a literal `#`, and the comment-stripping silently
 * swallows half of the value. Downstream, `parseClipping` then rejects the
 * file because the extracted `title` is now empty.
 *
 * This preprocessor rewrites `key: value` lines where the value is an
 * unquoted plain scalar containing ` #` by wrapping the value in single
 * quotes. Single-quoted YAML scalars are literal and do not honor `#`, so
 * the full value is preserved.
 *
 * Lines that are already quoted, use block/flow/anchor/tag indicators, or
 * are list items are left untouched — those are either already safe or out
 * of scope for this targeted fix.
 */
export function preprocessFrontmatter(body: string): string {
  return body
    .split(/\r?\n/)
    .map(rewriteLine)
    .join("\n");
}

// Matches `key: value`. The key must start with a non-colon, non-space
// character so `- foo` (list items) and fully-blank lines are ignored.
const KEY_VALUE_RE = /^(\s*[^\s:#][^:]*:\s+)(.*)$/;

function rewriteLine(line: string): string {
  const m = KEY_VALUE_RE.exec(line);
  if (!m) return line;
  const prefix = m[1];
  const rawValue = m[2];
  const value = rawValue.trimEnd();
  if (!value) return line;
  if (!isPlainScalar(value)) return line;
  // Only act when a comment marker is actually present; otherwise leave the
  // line byte-identical so diffs stay minimal and unrelated content is safe.
  if (!/\s#/.test(value)) return line;
  return prefix + singleQuote(value);
}

/**
 * True when `value` is a plain (unquoted) YAML scalar we can safely rewrap.
 * Anything that starts with a quote, block/flow indicator, anchor, alias, or
 * tag is out of scope.
 */
function isPlainScalar(value: string): boolean {
  const first = value[0];
  switch (first) {
    case '"':
    case "'":
    case "|":
    case ">":
    case "[":
    case "{":
    case "&":
    case "*":
    case "!":
      return false;
    default:
      return true;
  }
}

/** Wrap a value in YAML single quotes; embedded `'` is escaped by doubling. */
function singleQuote(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}
