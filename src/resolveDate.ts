import type { DateSource } from "./types.ts";

export type DateInputs = {
  filenameTimestamp?: Date;
  frontmatterDate?: Date;
  mtime?: Date;
};

/**
 * Pick a Date value for the FeedItem pubDate based on the configured strategy.
 *
 * - `filename`    : require the filename timestamp (most reliable for Obsidian Web Clipper).
 * - `frontmatter` : prefer frontmatter date, fall back to filename if missing.
 * - `mtime`       : require file mtime (warning: rsync/git checkout rewrites mtime).
 */
export function resolveDate(source: DateSource, inputs: DateInputs): Date {
  switch (source) {
    case "filename":
      if (!inputs.filenameTimestamp) {
        throw new Error(
          "resolveDate: dateSource=filename requires a filename timestamp prefix",
        );
      }
      return inputs.filenameTimestamp;
    case "frontmatter":
      return inputs.frontmatterDate ??
        inputs.filenameTimestamp ??
        raise(
          "resolveDate: dateSource=frontmatter requires either a frontmatter date or filename timestamp",
        );
    case "mtime":
      if (!inputs.mtime) {
        throw new Error("resolveDate: dateSource=mtime requires a file mtime");
      }
      return inputs.mtime;
  }
}

function raise(msg: string): never {
  throw new Error(msg);
}
