variable "project_id" {
  type = string
}

variable "shop_hostname" {
  type        = string
  description = "Customer portal hostname (e.g. dev-banking.example.com)."
}

variable "admin_hostname" {
  type        = string
  description = "Admin portal hostname."
}

variable "cert_map_name" {
  type    = string
  default = "banking-cert-map"
}

variable "global_address_name" {
  type    = string
  default = "banking-dev-portal-ip"
}

variable "create_global_address" {
  type    = bool
  default = true
}
