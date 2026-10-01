module "edge_portal" {
  source = "../../../modules/edge_portal"

  project_id            = var.project_id
  shop_hostname         = var.shop_hostname
  admin_hostname        = var.admin_hostname
  cert_map_name         = var.cert_map_name
  global_address_name   = var.global_address_name
  create_global_address = var.create_global_address
}

data "google_compute_global_address" "portal" {
  count   = var.create_global_address ? 0 : 1
  project = var.project_id
  name    = var.global_address_name
}

output "cert_map_name" {
  value = module.edge_portal.cert_map_name
}

output "portal_ip" {
  value = var.create_global_address ? module.edge_portal.portal_ip : data.google_compute_global_address.portal[0].address
}

output "dns_a_records" {
  value = {
    shop  = { host = var.shop_hostname, type = "A", data = var.create_global_address ? module.edge_portal.portal_ip : data.google_compute_global_address.portal[0].address }
    admin = { host = var.admin_hostname, type = "A", data = var.create_global_address ? module.edge_portal.portal_ip : data.google_compute_global_address.portal[0].address }
  }
}

output "dns_authorization_records" {
  value = module.edge_portal.dns_authorization_records
}
