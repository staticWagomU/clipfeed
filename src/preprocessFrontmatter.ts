/**
 * Pre-process a raw YAML frontmatter body to survive generator-side quirks
 * that violate strict YAML 1.2 rules.
 *
 * Two normalizations are applied in order:
 *
 * 1. Unquoted `# ...` truncation. In YAML, `key: value # tail` parses the
 *    value as just the text before ` #`. Obsidian Web Clipper emits lines
 *    like `title: Recipe # 4 servings` when a page title contains a literal
 *    `#`, silently losing half the value. We wrap such plain scalars in
 *    single quotes so the `#` is kept literal.
 *
 * 2. Invalid `\X` escapes in double-quoted scalars. YAML 1.2 defines a
 *    fixed escape set (`\n`, `\t`, `\"`, `\xHH`, `\uHHHH`, …); any other
 *    `\X` makes a strict parser reject the whole frontmatter. Obsidian Web
 *    Clipper wraps arbitrary page text in double quotes without escaping
 *    backslashes, so content like `\#hashtag` from author shorthand trips
 *    the parser. We rewrite each invalid `\X` to `\\X`, which YAML then
 *    reads as literal backslash + X — matching the author's intent.
 */
export function preprocessFrontmatter(body: string): string {
  const commentSafe = body.split(/\r?\n/).map(rewriteLine).join("\n");
  return neutralizeInvalidDoubleQuoteEscapes(commentSafe);
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

/** YAML 1.2 single-character escape set for double-quoted scalars (§5.7). */
const DQ_SINGLE_CHAR_ESCAPES = new Set([
  "0",
  "a",
  "b",
  "t",
  "n",
  "v",
  "f",
  "r",
  "e",
  '"',
  "/",
  "\\",
  "N",
  "_",
  "L",
  "P",
  " ",
  "\t",
]);

/**
 * Scan `body` tracking quote context and neutralize any `\X` inside a
 * double-quoted scalar where X is not a YAML 1.2 escape. The neutralized
 * form `\\X` parses as literal backslash + X — what the author meant when
 * the upstream generator failed to escape its output.
 */
function neutralizeInvalidDoubleQuoteEscapes(body: string): string {
  const out: string[] = [];
  let state: "normal" | "in-double" | "in-single" = "normal";
  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (state === "normal") {
      out.push(ch);
      if (ch === '"') state = "in-double";
      else if (ch === "'") state = "in-single";
      i++;
    } else if (state === "in-single") {
      // `''` is the single-quoted YAML escape for a literal apostrophe;
      // consume both so we don't leave the string on the inner `'`.
      if (ch === "'" && body[i + 1] === "'") {
        out.push("''");
        i += 2;
      } else {
        out.push(ch);
        if (ch === "'") state = "normal";
        i++;
      }
    } else {
      if (ch === "\\") {
        const consumed = consumeValidDqEscape(body, i);
        if (consumed > 0) {
          out.push(body.slice(i, i + consumed));
          i += consumed;
        } else {
          out.push("\\\\");
          i++;
        }
      } else {
        out.push(ch);
        if (ch === '"') state = "normal";
        i++;
      }
    }
  }
  return out.join("");
}

/**
 * Length of the valid escape sequence starting at `body[i]` (which must be
 * `\`), or 0 if it is not a recognized YAML 1.2 escape.
 */
function consumeValidDqEscape(body: string, i: number): number {
  const next = body[i + 1];
  if (next === undefined) return 0;
  if (next === "\n") return 2;
  if (next === "\r") return body[i + 2] === "\n" ? 3 : 2;
  if (DQ_SINGLE_CHAR_ESCAPES.has(next)) return 2;
  if (next === "x") return hasHexDigits(body, i + 2, 2) ? 4 : 0;
  if (next === "u") return hasHexDigits(body, i + 2, 4) ? 6 : 0;
  if (next === "U") return hasHexDigits(body, i + 2, 8) ? 10 : 0;
  return 0;
}

function hasHexDigits(body: string, start: number, count: number): boolean {
  for (let j = 0; j < count; j++) {
    const c = body[start + j];
    if (c === undefined || !/[0-9a-fA-F]/.test(c)) return false;
  }
  return true;
}
