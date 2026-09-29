# Branching: feature → develop → main

GitHub: **[sadaf-jamal-au27/apex-bank-infra](https://github.com/sadaf-jamal-au27/apex-bank-infra)**

```text
feature/<name>  ──PR──►  develop  ──PR──►  main
                     │
                     ├─ PR: fmt/validate + terraform plan (needs WIF after bootstrap)
                     └─ merge to develop: terraform apply (dev GCP)
```

| Branch | Role |
|--------|------|
| **`feature/<name>`** | Short-lived. **PR into `develop` only.** |
| **`develop`** | Integration. Plan on PR. Apply on merge (or Actions → Run workflow). |
| **`main`** | Release gate. Only **`develop` → `main`**. Same GCP `dev` until a prod project exists. |

Do **not** push directly to `develop` or `main`.

## CI

| Event | Workflow |
|-------|----------|
| PR → `develop` / `main` | `infra-plan.yml` — fmt/validate, then plan |
| PR **merged into `develop`**, or **workflow_dispatch** | `infra-apply.yml` — plan + apply `00`→`06` |

Environment **`dev`**: `GCP_WIF_PROVIDER`, `GCP_CI_SERVICE_ACCOUNT`, `TF_VAR_DATABASE_PASSWORD`.

First WIF is laptop: apply `00-foundation` then `01-iam`. Until then plan/apply fail at Google auth; fmt/validate still run.

Protect **`develop`** and **`main`** (PR required; required check **Terraform fmt & validate**).
