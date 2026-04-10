import { S3Client } from "@bradenmacdonald/s3-lite-client";

/**
 * Upload a feed.xml file to Cloudflare R2 using the S3-compatible API.
 *
 * Required environment variables:
 *   R2_ACCOUNT_ID         Cloudflare account ID
 *   R2_ACCESS_KEY_ID      R2 S3 API access key
 *   R2_SECRET_ACCESS_KEY  R2 S3 API secret key
 *   R2_BUCKET             R2 bucket name
 * Optional:
 *   R2_OBJECT_KEY         Object key in the bucket (default: feed.xml)
 */
export async function uploadToR2(localPath: string): Promise<void> {
  const accountId = requireEnv("R2_ACCOUNT_ID");
  const accessKey = requireEnv("R2_ACCESS_KEY_ID");
  const secretKey = requireEnv("R2_SECRET_ACCESS_KEY");
  const bucket = requireEnv("R2_BUCKET");
  const objectKey = Deno.env.get("R2_OBJECT_KEY") || "feed.xml";

  const client = new S3Client({
    endPoint: `${accountId}.r2.cloudflarestorage.com`,
    region: "auto",
    accessKey,
    secretKey,
    bucket,
    useSSL: true,
  });

  const body = await Deno.readFile(localPath);
  await client.putObject(objectKey, body, {
    metadata: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
  console.log(`clipfeed: uploaded to r2://${bucket}/${objectKey}`);
}

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) {
    throw new Error(`uploadToR2: missing required environment variable ${name}`);
  }
  return v;
}
