locals {
  policy_id      = var.create_access_policy ? google_access_context_manager_access_policy.banking[0].name : var.access_policy_id
  perimeter_name = "banking_${replace(var.env, "-", "_")}"
  ingress_identities = distinct(compact(concat(
    var.ci_service_account_email != "" ? ["serviceAccount:${var.ci_service_account_email}"] : [],
    var.ingress_identities,
  )))
}

resource "google_access_context_manager_access_policy" "banking" {
  count  = var.enable_vpc_sc && var.create_access_policy ? 1 : 0
  parent = "organizations/${var.org_id}"
  title  = "banking-${var.env}"
}

# GitHub-hosted runners are outside the perimeter. Member-only access levels
# do not match consumer Gmail; IP 0.0.0.0/0 plus explicit identities is the
# workable pattern until a self-hosted runner lives inside the VPC.
resource "google_access_context_manager_access_level" "ci" {
  count = var.enable_vpc_sc && length(local.ingress_identities) > 0 ? 1 : 0

  parent = "accessPolicies/${local.policy_id}"
  name   = "accessPolicies/${local.policy_id}/accessLevels/${local.perimeter_name}_gha"
  title  = "banking-${var.env}-gha"

  basic {
    conditions {
      ip_subnetworks = ["0.0.0.0/0", "::/0"]
    }
  }
}

resource "google_access_context_manager_service_perimeter" "banking" {
  count = var.enable_vpc_sc && length(local.ingress_identities) > 0 ? 1 : 0

  parent = "accessPolicies/${local.policy_id}"
  name   = "accessPolicies/${local.policy_id}/servicePerimeters/${local.perimeter_name}"
  title  = "banking-${var.env}-regular"

  status {
    resources           = ["projects/${var.project_number}"]
    restricted_services = var.restricted_services

    vpc_accessible_services {
      enable_restriction = true
      allowed_services   = ["RESTRICTED-SERVICES"]
    }

    ingress_policies {
      ingress_from {
        identities = local.ingress_identities
        sources {
          access_level = google_access_context_manager_access_level.ci[0].name
        }
      }
      ingress_to {
        resources = ["*"]
        operations {
          service_name = "*"
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [status[0].access_levels]
  }
}
