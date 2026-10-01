output "cert_map_name" {
  value = google_certificate_manager_certificate_map.portal.name
}

output "portal_ip" {
  value = var.create_global_address ? google_compute_global_address.portal[0].address : null
}

output "global_address_name" {
  value = var.global_address_name
}

output "shop_hostname" {
  value = var.shop_hostname
}

output "admin_hostname" {
  value = var.admin_hostname
}

output "dns_authorization_records" {
  description = "Add these at your DNS provider (in addition to A records to portal_ip) until certs become ACTIVE."
  value = {
    shop = {
      name = google_certificate_manager_dns_authorization.shop.dns_resource_record[0].name
      type = google_certificate_manager_dns_authorization.shop.dns_resource_record[0].type
      data = google_certificate_manager_dns_authorization.shop.dns_resource_record[0].data
    }
    admin = {
      name = google_certificate_manager_dns_authorization.admin.dns_resource_record[0].name
      type = google_certificate_manager_dns_authorization.admin.dns_resource_record[0].type
      data = google_certificate_manager_dns_authorization.admin.dns_resource_record[0].data
    }
  }
}
