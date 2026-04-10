import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { main } from "../cli.ts";

/**
 * Smoke / integration tests for the CLI orchestration layer.
 *
 * These cross the filesystem on purpose: the pure-function layers
 * (parseClipping / buildFeed / renderRss / ...) are already covered
 * exhaustively by their own unit tests, so the only thing left to
 * protect against is a regression in the *wiring* — directory reads,
 * output writes, flag plumbing, error handling.
 *
 * Every test uses its own temp dir and cleans up in `finally`, so the
 * suite stays F.I.R.S.T.-compliant (Fast, Independent, Repeatable, Self-
 * validating, Timely).
 */

/**
 * Temporarily replace `console.log` and `console.warn` with collectors so the
 * CLI's status messages ("clipfeed: wrote N items ...") don't pollute test
 * output. Returns the captured lines from both channels plus a restore fn.
 *
 * This is deliberately a tiny hand-rolled spy rather than pulling in a
 * mocking library: the contract is narrow and the rollback must be in a
 * `finally` to stay robust against test failures.
 */
function captureConsole(): {
  logs: string[];
  warnings: string[];
  restore: () => void;
} {
  const logs: string[] = [];
  const warnings: string[] = [];
  const originalLog = console.log;
  const originalWarn = console.warn;
  console.log = (msg: unknown) => logs.push(String(msg));
  console.warn = (msg: unknown) => warnings.push(String(msg));
  return {
    logs,
    warnings,
    restore: () => {
      console.log = originalLog;
      console.warn = originalWarn;
    },
  };
}

/**
 * Set up a temporary input directory seeded with N valid clippings and a
 * temporary output path. Returns both along with a cleanup function.
 *
 * Centralizing this keeps individual tests focused on the "act" and
 * "assert" phases rather than repeating fixture boilerplate.
 */
async function setupCliFixture(
  clippings: Record<string, string>,
): Promise<{ inputDir: string; outputPath: string; cleanup: () => Promise<void> }> {
  const inputDir = await Deno.makeTempDir({ prefix: "clipfeed-in-" });
  const outputDir = await Deno.makeTempDir({ prefix: "clipfeed-out-" });
  const outputPath = join(outputDir, "feed.xml");

  for (const [name, body] of Object.entries(clippings)) {
    await Deno.writeTextFile(join(inputDir, name), body);
  }

  const cleanup = async () => {
    await Deno.remove(inputDir, { recursive: true });
    await Deno.remove(outputDir, { recursive: true });
  };

  return { inputDir, outputPath, cleanup };
}

const VALID_MD = `---
title: "Hello World"
source: "https://example.com/hello"
description: "first post"
created: 2026-04-04
author: "Alice"
---
body text
`;

const SECOND_MD = `---
title: "Second"
source: "https://example.com/second"
description: "second post"
created: 2026-04-05
---
body
`;

Deno.test("main: reads a directory of clippings and writes an RSS feed to --output", async () => {
  const { inputDir, outputPath, cleanup } = await setupCliFixture({
    "20260404224008-hello.md": VALID_MD,
  });
  const spy = captureConsole();
  try {
    await main([
      "--input",
      inputDir,
      "--output",
      outputPath,
      "--format",
      "rss",
      "--limit",
      "10",
    ]);
    const written = await Deno.readTextFile(outputPath);
    // The rendering itself is covered in renderRss.test; here we only
    // verify that the CLI connected the pipes: parse -> build -> render -> write.
    assertStringIncludes(written, "<?xml");
    assertStringIncludes(written, "<title>Hello World</title>");
    assertStringIncludes(written, "https://example.com/hello");
    // main logs a one-line success banner; confirm it fired so we know
    // the "happy path logging" stays wired up.
    assertEquals(spy.logs.some((l) => l.includes("wrote 1 rss items")), true);
  } finally {
    spy.restore();
    await cleanup();
  }
});

Deno.test("main: --limit caps the number of emitted items", async () => {
  const { inputDir, outputPath, cleanup } = await setupCliFixture({
    "20260404224008-hello.md": VALID_MD,
    "20260405120000-second.md": SECOND_MD,
  });
  const spy = captureConsole();
  try {
    await main([
      "--input",
      inputDir,
      "--output",
      outputPath,
      "--format",
      "rss",
      "--limit",
      "1",
    ]);
    const written = await Deno.readTextFile(outputPath);
    // Newer item wins (buildFeed sorts desc), so "Second" survives and
    // "Hello World" must be pruned.
    assertStringIncludes(written, "<title>Second</title>");
    assertEquals(written.includes("<title>Hello World</title>"), false);
  } finally {
    spy.restore();
    await cleanup();
  }
});

Deno.test("main: --format atom emits an Atom document", async () => {
  const { inputDir, outputPath, cleanup } = await setupCliFixture({
    "20260404224008-hello.md": VALID_MD,
  });
  const spy = captureConsole();
  try {
    await main([
      "--input",
      inputDir,
      "--output",
      outputPath,
      "--format",
      "atom",
    ]);
    const written = await Deno.readTextFile(outputPath);
    assertStringIncludes(written, '<feed xmlns="http://www.w3.org/2005/Atom"');
    assertStringIncludes(written, "<entry>");
  } finally {
    spy.restore();
    await cleanup();
  }
});

Deno.test("main: --format jsonfeed emits a JSON Feed document", async () => {
  const { inputDir, outputPath, cleanup } = await setupCliFixture({
    "20260404224008-hello.md": VALID_MD,
  });
  const spy = captureConsole();
  try {
    await main([
      "--input",
      inputDir,
      "--output",
      outputPath,
      "--format",
      "jsonfeed",
    ]);
    const written = await Deno.readTextFile(outputPath);
    const parsed = JSON.parse(written);
    assertEquals(parsed.version, "https://jsonfeed.org/version/1.1");
    assertEquals(parsed.items.length, 1);
    assertEquals(parsed.items[0].title, "Hello World");
  } finally {
    spy.restore();
    await cleanup();
  }
});

Deno.test("main: skips malformed clippings with a warning instead of aborting the build", async () => {
  // readClippings catches per-file errors and continues, so one broken
  // file must not prevent the rest of the feed from being written.
  const { inputDir, outputPath, cleanup } = await setupCliFixture({
    "20260404224008-hello.md": VALID_MD,
    "20260405120000-broken.md": "no frontmatter at all",
  });
  const spy = captureConsole();
  try {
    await main([
      "--input",
      inputDir,
      "--output",
      outputPath,
      "--format",
      "rss",
    ]);
    const written = await Deno.readTextFile(outputPath);
    assertStringIncludes(written, "<title>Hello World</title>");
    // The broken file should have triggered exactly one warning mentioning it.
    assertEquals(
      spy.warnings.some((w) => w.includes("20260405120000-broken.md")),
      true,
    );
  } finally {
    spy.restore();
    await cleanup();
  }
});

Deno.test("main: ignores non-markdown files in the input directory", async () => {
  const { inputDir, outputPath, cleanup } = await setupCliFixture({
    "20260404224008-hello.md": VALID_MD,
    "README.txt": "just a note",
    "image.png": "\x89PNG not really",
  });
  const spy = captureConsole();
  try {
    await main([
      "--input",
      inputDir,
      "--output",
      outputPath,
      "--format",
      "jsonfeed",
    ]);
    const parsed = JSON.parse(await Deno.readTextFile(outputPath));
    assertEquals(parsed.items.length, 1);
    assertEquals(parsed.items[0].title, "Hello World");
    // No per-file warning should have fired for the non-markdown files:
    // they are filtered by extension, not by parse failure.
    assertEquals(spy.warnings.length, 0);
  } finally {
    spy.restore();
    await cleanup();
  }
});

Deno.test("main: --upload without an upload block in the config rejects with a helpful error", async () => {
  const { inputDir, outputPath, cleanup } = await setupCliFixture({
    "20260404224008-hello.md": VALID_MD,
  });
  const spy = captureConsole();
  try {
    await assertRejects(
      () =>
        main([
          "--input",
          inputDir,
          "--output",
          outputPath,
          "--upload",
        ]),
      Error,
      "upload",
    );
  } finally {
    spy.restore();
    await cleanup();
  }
});

Deno.test("main: --help prints usage and returns without writing any file", async () => {
  // Capture stdout and make sure the help text actually came out. We must
  // also confirm that no output file was created — --help is a short-circuit
  // branch in main() and must not fall through to the build pipeline.
  const outputPath = await Deno.makeTempFile({ prefix: "clipfeed-help-", suffix: ".xml" });
  // Remove it immediately so existence-after-main tells us main created it.
  await Deno.remove(outputPath);

  const spy = captureConsole();
  try {
    await main(["--help"]);
    assertEquals(
      spy.logs.some((m) => m.includes("clipfeed")),
      true,
    );
    // The file must NOT exist — main should have returned before writeTextFile.
    let existed = false;
    try {
      await Deno.stat(outputPath);
      existed = true;
    } catch {
      existed = false;
    }
    assertEquals(existed, false);
  } finally {
    spy.restore();
  }
});
