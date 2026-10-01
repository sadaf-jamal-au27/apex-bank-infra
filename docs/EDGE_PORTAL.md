# Banking public edge (Terraform + Gateway API)

Production-style edge: **Certificate Manager + cert map** in Terraform; **GKE Gateway API** in apex-bank-devops Helm.

## 1. Enable APIs (once per project)

```bash
gcloud services enable certificatemanager.googleapis.com --project=ai-rag-agent-project
```

CI service account needs **`roles/certificatemanager.admin`** (in `01-iam` / `github_wif.terraform_roles`). After adding the role, re-apply stack **`01-iam`**, then **`07-edge`**.

## 2. Terraform (`terraform/live/dev/07-edge`)

Configure `backend.tf` GCS bucket (same as other stacks), then:

```bash
cd banking-infra/gke-banking-infra
node scripts/terraform-stacks.mjs init dev
node scripts/terraform-stacks.mjs plan dev
node scripts/terraform-stacks.mjs apply dev
```

`create_global_address = false` when `banking-dev-portal-ip` already exists.

Outputs:

- `portal_ip` — DNS A records for both hostnames
- `dns_authorization_records` — **extra** CNAME/TXT for Google-managed certs (add at registrar until certs ACTIVE)
- `cert_map_name` — must match Helm `gateway.certMap` (`banking-cert-map`)

## 3. DNS

| Type | Host | Value |
|------|------|--------|
| A | `dev-banking` | `portal_ip` |
| A | `dev-banking-admin` | same |
| (from TF output) | cert DNS auth records | per `dns_authorization_records` |

## 4. Helm (apex-bank-devops)

Remove legacy Ingress if still present:

```bash
kubectl delete ingress -n banking-dev -l app.kubernetes.io/name=banking-platform --ignore-not-found
kubectl delete managedcertificate -n banking-dev --all --ignore-not-found
```

Deploy Gateway:

```bash
helm upgrade --install banking-platform helm/banking-platform -n banking-dev \
  -f helm/banking-platform/values-dev.yaml \
  --set global.imageTag=develop-latest --wait --timeout 20m
```

```bash
kubectl -n banking-dev get gateway banking-external-gateway
# ADDRESS → must match portal_ip
```

## 5. Verify

```bash
curl -sI https://dev-banking.beyondthecloud.in/
curl -s https://dev-banking.beyondthecloud.in/health/live
```

Routes: `/` → customer-web; `/v1`, `/api` (→ `/v1`), `/health` → bff-api-service.
