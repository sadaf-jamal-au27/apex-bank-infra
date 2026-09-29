data "google_project" "current" {
  project_id = var.project_id
}

data "terraform_remote_state" "iam" {
  backend = "gcs"

  config = {
    bucket = var.state_bucket_name
    prefix = "banking/dev/01-iam"
  }
}

locals {
  # 01-iam must be applied before this stack; empty state during first CI plan is expected.
  ci_service_account_email = try(data.terraform_remote_state.iam.outputs.ci_service_account_email, "")
}

module "vpc_sc" {
  source = "../../../modules/vpc_sc"

  org_id                   = var.org_id
  project_number           = data.google_project.current.number
  env                      = var.env
  enable_vpc_sc            = var.enable_vpc_sc && local.ci_service_account_email != ""
  access_policy_id         = var.access_policy_id
  create_access_policy     = var.create_access_policy && local.ci_service_account_email != ""
  ci_service_account_email = local.ci_service_account_email
}
