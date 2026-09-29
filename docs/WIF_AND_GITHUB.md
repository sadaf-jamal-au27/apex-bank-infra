# WIF + GitHub

**GCP:** `ai-rag-agent-project` · **region:** `asia-south1`  
**Infra repo:** [sadaf-jamal-au27/apex-bank-infra](https://github.com/sadaf-jamal-au27/apex-bank-infra)  
**App repo:** [sadaf-jamal-au27/apex-bank-app](https://github.com/sadaf-jamal-au27/apex-bank-app)

`github_repos` must list every repo that federates:

```hcl
github_repos = [
  "apex-bank-app",
  "apex-bank-infra",
]
```

Laptop (first time): apply `00-foundation` then `01-iam`. Put outputs in GitHub Environment **dev**:

| Secret | Terraform output (stack `01-iam`) |
|--------|-------------------------------------|
| `GCP_WIF_PROVIDER` | `wif_provider` |
| `GCP_CI_SERVICE_ACCOUNT` | `ci_service_account_email` |
| `TF_VAR_DATABASE_PASSWORD` | Cloud SQL app password (`06-data`) |

OIDC issuer is GitHub (`token.actions.githubusercontent.com`). No service-account JSON keys.
