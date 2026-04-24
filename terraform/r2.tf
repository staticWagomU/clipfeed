resource "cloudflare_r2_bucket" "feed" {
  account_id = var.cloudflare_account_id
  name       = var.bucket_name
  location   = var.bucket_location
}

resource "cloudflare_r2_custom_domain" "feed" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.feed.name
  domain      = var.feed_domain
  zone_id     = var.zone_id
  enabled     = true
  min_tls     = "1.2"
}
