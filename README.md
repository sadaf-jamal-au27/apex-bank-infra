# apex-bank-infra

Apex Bank GCP landing zone (native Terraform).  
GitHub: [sadaf-jamal-au27/apex-bank-infra](https://github.com/sadaf-jamal-au27/apex-bank-infra)  
Branching: `docs/BRANCHING.md` · WIF: `.github/GITHUB_SETUP.md`

```text
terraform/modules/     # kms, iam, network, vpc_sc, gke, cloudsql, github_wif, …
terraform/live/dev/    # 00-foundation → 06-data
```

```bash
cp terraform/live/dev/shared.tfvars.example terraform/live/dev/shared.tfvars
# first time: apply 00-foundation then 01-iam from this laptop (creates OIDC/WIF)
node scripts/terraform-stacks.mjs plan dev
```
