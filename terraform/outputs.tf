output "bucket_name" {
  description = "R2 bucket name — paste into clipfeed config's upload.bucket"
  value       = cloudflare_r2_bucket.feed.name
}

output "s3_endpoint" {
  description = "S3-compatible endpoint — paste into clipfeed config's upload.endpoint"
  value       = "${var.cloudflare_account_id}.r2.cloudflarestorage.com"
}

output "feed_url" {
  description = "Public URL the RSS reader should subscribe to"
  value       = "https://${var.feed_domain}/feed.xml"
}
