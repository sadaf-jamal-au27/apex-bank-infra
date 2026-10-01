variable "shop_hostname" {
  type    = string
  default = "dev-banking.beyondthecloud.in"
}

variable "admin_hostname" {
  type    = string
  default = "dev-banking-admin.beyondthecloud.in"
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
  type        = bool
  default     = false
  description = "Set false when banking-dev-portal-ip already exists."
}
