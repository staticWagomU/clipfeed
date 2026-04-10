import { S3Client } from "@bradenmacdonald/s3-lite-client";
import type { UploadConfig } from "../types.ts";

export type S3ClientOptions = {
  endPoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  useSSL: boolean;
};

/** Reader function shape, matching `Deno.env.get`, used for testable env injection. */
export type EnvReader = (name: string) => string | undefined;

const DEFAULT_ACCESS_KEY_ENV = "AWS_ACCESS_KEY_ID";
const DEFAULT_SECRET_KEY_ENV = "AWS_SECRET_ACCESS_KEY";

/**
 * Pull access key and secret from the configured env var names,
 * falling back to the AWS-standard names. Throws if either is missing.
 */
export function resolveS3Credentials(
  cfg: UploadConfig,
  env: EnvReader,
): { accessKey: string; secretKey: string } {
  const akName = cfg.accessKeyIdEnv ?? DEFAULT_ACCESS_KEY_ENV;
  const skName = cfg.secretAccessKeyEnv ?? DEFAULT_SECRET_KEY_ENV;
  const accessKey = env(akName);
  const secretKey = env(skName);
  if (!accessKey) {
    throw new Error(`resolveS3Credentials: missing env var ${akName}`);
  }
  if (!secretKey) {
    throw new Error(`resolveS3Credentials: missing env var ${skName}`);
  }
  return { accessKey, secretKey };
}

/** Map an UploadConfig into the option bag expected by s3-lite-client's S3Client. */
export function resolveS3Options(cfg: UploadConfig, env: EnvReader): S3ClientOptions {
  const { accessKey, secretKey } = resolveS3Credentials(cfg, env);
  return {
    endPoint: cfg.endpoint,
    region: cfg.region,
    bucket: cfg.bucket,
    accessKey,
    secretKey,
    useSSL: cfg.useSSL ?? true,
  };
}

/**
 * Upload a local file to any S3-compatible object store (R2, S3, MinIO, B2, Wasabi, ...).
 */
export async function uploadS3(localPath: string, cfg: UploadConfig): Promise<void> {
  const opts = resolveS3Options(cfg, (k) => Deno.env.get(k));
  const client = new S3Client(opts);
  const body = await Deno.readFile(localPath);
  await client.putObject(cfg.objectKey, body, {
    metadata: { "Content-Type": contentTypeFor(cfg.objectKey) },
  });
  console.log(`clipfeed: uploaded to ${cfg.bucket}/${cfg.objectKey} (${cfg.endpoint})`);
}

function contentTypeFor(key: string): string {
  if (key.endsWith(".json")) return "application/feed+json; charset=utf-8";
  if (key.endsWith(".atom") || key.endsWith(".atom.xml")) {
    return "application/atom+xml; charset=utf-8";
  }
  return "application/rss+xml; charset=utf-8";
}
