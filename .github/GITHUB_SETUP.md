# GitHub + WIF (apex-bank-infra)

This directory **is** the git root: https://github.com/sadaf-jamal-au27/apex-bank-infra

OIDC issuer: `https://token.actions.githubusercontent.com`  
Trusted repos (Terraform `github_repos`): `apex-bank-app`, `apex-bank-infra`.

## Bootstrap (once, from a laptop)

1. `cp terraform/live/dev/shared.tfvars.example terraform/live/dev/shared.tfvars`
2. Apply `00-foundation` then `01-iam` (creates the workload identity pool + CI SA).
3. GitHub → Settings → Environments → **`dev`**:
   - `GCP_WIF_PROVIDER` — `terraform output -raw wif_provider` from `01-iam`
   - `GCP_CI_SERVICE_ACCOUNT` — `ci_service_account_email`
   - `TF_VAR_DATABASE_PASSWORD` — Cloud SQL app user (needed for stack `06-data`)
4. Protect `develop` / `main`.

## After that

PRs run plan via OIDC. Merge to **`develop`** runs apply. No JSON key files.
