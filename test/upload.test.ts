import { assertEquals, assertThrows } from "@std/assert";
import { resolveS3Credentials, resolveS3Options } from "../src/upload/s3.ts";
import type { UploadConfig } from "../src/types.ts";

Deno.test("resolveS3Options: R2 config maps to s3-lite-client options", () => {
  const cfg: UploadConfig = {
    type: "s3",
    endpoint: "abc123.r2.cloudflarestorage.com",
    region: "auto",
    bucket: "my-feed",
    objectKey: "feed.xml",
    accessKeyIdEnv: "R2_ACCESS_KEY_ID",
    secretAccessKeyEnv: "R2_SECRET_ACCESS_KEY",
  };
  const env = {
    R2_ACCESS_KEY_ID: "AKIA...",
    R2_SECRET_ACCESS_KEY: "secret",
  };
  const opts = resolveS3Options(cfg, (k) => env[k as keyof typeof env]);
  assertEquals(opts.endPoint, "abc123.r2.cloudflarestorage.com");
  assertEquals(opts.region, "auto");
  assertEquals(opts.bucket, "my-feed");
  assertEquals(opts.useSSL, true);
  assertEquals(opts.accessKey, "AKIA...");
  assertEquals(opts.secretKey, "secret");
});

Deno.test("resolveS3Options: AWS S3 config", () => {
  const cfg: UploadConfig = {
    type: "s3",
    endpoint: "s3.amazonaws.com",
    region: "us-east-1",
    bucket: "my-bucket",
    objectKey: "feed.xml",
    accessKeyIdEnv: "AWS_ACCESS_KEY_ID",
    secretAccessKeyEnv: "AWS_SECRET_ACCESS_KEY",
  };
  const env = { AWS_ACCESS_KEY_ID: "AKIAAWS", AWS_SECRET_ACCESS_KEY: "aws-secret" };
  const opts = resolveS3Options(cfg, (k) => env[k as keyof typeof env]);
  assertEquals(opts.endPoint, "s3.amazonaws.com");
  assertEquals(opts.region, "us-east-1");
  assertEquals(opts.accessKey, "AKIAAWS");
});

Deno.test("resolveS3Options: MinIO with useSSL=false", () => {
  const cfg: UploadConfig = {
    type: "s3",
    endpoint: "localhost:9000",
    region: "us-east-1",
    bucket: "test",
    objectKey: "feed.xml",
    accessKeyIdEnv: "MINIO_ACCESS_KEY",
    secretAccessKeyEnv: "MINIO_SECRET_KEY",
    useSSL: false,
  };
  const env = { MINIO_ACCESS_KEY: "minioadmin", MINIO_SECRET_KEY: "minioadmin" };
  const opts = resolveS3Options(cfg, (k) => env[k as keyof typeof env]);
  assertEquals(opts.useSSL, false);
  assertEquals(opts.endPoint, "localhost:9000");
});

Deno.test("resolveS3Options: default env var names fall back to AWS_* when not specified", () => {
  const cfg: UploadConfig = {
    type: "s3",
    endpoint: "s3.amazonaws.com",
    region: "us-east-1",
    bucket: "b",
    objectKey: "feed.xml",
  };
  const env = { AWS_ACCESS_KEY_ID: "default-ak", AWS_SECRET_ACCESS_KEY: "default-sk" };
  const opts = resolveS3Options(cfg, (k) => env[k as keyof typeof env]);
  assertEquals(opts.accessKey, "default-ak");
  assertEquals(opts.secretKey, "default-sk");
});

Deno.test("resolveS3Credentials: throws when access key env var is missing", () => {
  const cfg: UploadConfig = {
    type: "s3",
    endpoint: "x",
    region: "auto",
    bucket: "b",
    objectKey: "feed.xml",
    accessKeyIdEnv: "MISSING_AK",
    secretAccessKeyEnv: "MISSING_SK",
  };
  assertThrows(
    () => resolveS3Credentials(cfg, () => undefined),
    Error,
    "MISSING_AK",
  );
});

Deno.test("resolveS3Credentials: throws with the SECRET env var name when only the secret is missing", () => {
  // Symmetric counterpart to the access-key case: the error must point at the
  // specific env var the user forgot, not just the first one the code checks.
  const cfg: UploadConfig = {
    type: "s3",
    endpoint: "x",
    region: "auto",
    bucket: "b",
    objectKey: "feed.xml",
    accessKeyIdEnv: "PRESENT_AK",
    secretAccessKeyEnv: "MISSING_SK",
  };
  const env: Record<string, string> = { PRESENT_AK: "ak-value" };
  assertThrows(
    () => resolveS3Credentials(cfg, (k) => env[k]),
    Error,
    "MISSING_SK",
  );
});

Deno.test("resolveS3Options: useSSL defaults to true when not set in config", () => {
  const cfg: UploadConfig = {
    type: "s3",
    endpoint: "s3.amazonaws.com",
    region: "us-east-1",
    bucket: "b",
    objectKey: "feed.xml",
  };
  const env = { AWS_ACCESS_KEY_ID: "a", AWS_SECRET_ACCESS_KEY: "s" };
  const opts = resolveS3Options(cfg, (k) => env[k as keyof typeof env]);
  assertEquals(opts.useSSL, true);
});
