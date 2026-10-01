terraform {
  required_providers {
    google = {
      source = "hashicorp/google"
    }
  }
}

resource "google_compute_global_address" "portal" {
  count   = var.create_global_address ? 1 : 0
  project = var.project_id
  name    = var.global_address_name
}

resource "google_certificate_manager_dns_authorization" "shop" {
  project = var.project_id
  name    = "banking-shop-dnsauth"
  domain  = var.shop_hostname
}

resource "google_certificate_manager_dns_authorization" "admin" {
  project = var.project_id
  name    = "banking-admin-dnsauth"
  domain  = var.admin_hostname
}

resource "google_certificate_manager_certificate" "shop" {
  project = var.project_id
  name    = "banking-shop-cert"
  managed {
    domains            = [var.shop_hostname]
    dns_authorizations = [google_certificate_manager_dns_authorization.shop.id]
  }
}

resource "google_certificate_manager_certificate" "admin" {
  project = var.project_id
  name    = "banking-admin-cert"
  managed {
    domains            = [var.admin_hostname]
    dns_authorizations = [google_certificate_manager_dns_authorization.admin.id]
  }
}

resource "google_certificate_manager_certificate_map" "portal" {
  project = var.project_id
  name    = var.cert_map_name
}

resource "google_certificate_manager_certificate_map_entry" "shop" {
  project      = var.project_id
  name         = "banking-shop"
  map          = google_certificate_manager_certificate_map.portal.name
  certificates = [google_certificate_manager_certificate.shop.id]
  hostname     = var.shop_hostname
}

resource "google_certificate_manager_certificate_map_entry" "admin" {
  project      = var.project_id
  name         = "banking-admin"
  map          = google_certificate_manager_certificate_map.portal.name
  certificates = [google_certificate_manager_certificate.admin.id]
  hostname     = var.admin_hostname
}
