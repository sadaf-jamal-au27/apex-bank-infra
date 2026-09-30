resource "google_service_account" "break_glass" {
  account_id   = "banking-breakglass-${var.env}"
  display_name = "Break-glass (no WIF, human impersonation only)"
}

# Owner cannot be granted by GitHub CI (needs setIamPolicy + usually an existing Owner).
# Bind it from a laptop after humans are listed in break_glass_members.
resource "google_project_iam_member" "break_glass_owner" {
  count   = length(var.break_glass_members) > 0 ? 1 : 0
  project = var.project_id
  role    = "roles/owner"
  member  = "serviceAccount:${google_service_account.break_glass.email}"
}

resource "google_service_account_iam_member" "break_glass_impersonate" {
  for_each = toset(var.break_glass_members)

  service_account_id = google_service_account.break_glass.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = each.value
}
