#!/usr/bin/env node
/**
 * Banking landing zone — ordered stacks with environment-specific GCS state.
 *
 *   node scripts/terraform-stacks.mjs fmt
 *   node scripts/terraform-stacks.mjs validate dev
 *   node scripts/terraform-stacks.mjs preflight dev
 *   TF_VAR_database_password=... node scripts/terraform-stacks.mjs plan dev
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");

const STACKS = [
  "00-foundation",
  "01-iam",
  "02-network",
  "03-vpcsc",
  "04-security",
  "05-platform",
  "06-data",
];

function liveDir(env) {
  return path.join(REPO, "terraform/live", env);
}

function stackDir(env, stack) {
  return path.join(liveDir(env), stack);
}

function sharedTfvars(env) {
  return path.join(liveDir(env), "shared.tfvars");
}

function readStateBucket(env) {
  const tfvars = existsSync(sharedTfvars(env))
    ? sharedTfvars(env)
    : path.join(liveDir(env), "shared.tfvars.example");
  if (!existsSync(tfvars)) {
    console.error(`Missing ${tfvars}`);
    process.exit(1);
  }
  const m = readFileSync(tfvars, "utf-8").match(/state_bucket_name\s*=\s*"([^"]+)"/);
  return m?.[1];
}

function run(cmd, args, cwd) {
  const res = spawnSync(cmd, args, { stdio: "inherit", cwd, env: process.env });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

function extraVarFiles(env) {
  const shared = sharedTfvars(env);
  const example = path.join(liveDir(env), "shared.tfvars.example");
  if (existsSync(shared)) return ["-var-file", shared];
  if (existsSync(example)) return ["-var-file", example];
  return [];
}

function tfvarsPath(env) {
  const shared = sharedTfvars(env);
  if (existsSync(shared)) return shared;
  return path.join(liveDir(env), "shared.tfvars.example");
}

function readTfString(env, key) {
  const m = readFileSync(tfvarsPath(env), "utf-8").match(
    new RegExp(`${key}\\s*=\\s*"([^"]+)"`)
  );
  return m?.[1] ?? "";
}

function readTfBool(env, key) {
  const m = readFileSync(tfvarsPath(env), "utf-8").match(
    new RegExp(`${key}\\s*=\\s*(true|false)`)
  );
  return m?.[1] === "true";
}

function gcloudOut(args) {
  return spawnSync("gcloud", args, { encoding: "utf-8" });
}

function activeAccount() {
  const res = gcloudOut(["auth", "list", "--filter=status:ACTIVE", "--format=value(account)"]);
  return (res.stdout || "").trim().split("\n")[0] || "";
}

function iamMember(email) {
  if (!email) return "";
  if (email.endsWith(".gserviceaccount.com") || email.includes("iam.gserviceaccount.com")) {
    return `serviceAccount:${email}`;
  }
  return `user:${email}`;
}

function roleSet(parentKind, parentId, member) {
  const args =
    parentKind === "org"
      ? ["organizations", "get-iam-policy", parentId, "--format=json"]
      : ["projects", "get-iam-policy", parentId, "--format=json"];
  const res = gcloudOut(args);
  if (res.status !== 0) return new Set();
  try {
    const policy = JSON.parse(res.stdout || "{}");
    const roles = new Set();
    for (const b of policy.bindings ?? []) {
      if (b.members?.includes(member)) roles.add(b.role);
    }
    return roles;
  } catch {
    return new Set();
  }
}

function requireCoveringRole(roles, covering, why) {
  if (covering.some((r) => roles.has(r))) return;
  console.error(
    `preflight: missing IAM for ${why}. Need one of: ${covering.join(", ")}. ` +
      `Grant it with gcloud, then re-run plan (do not wait for apply).`
  );
  process.exit(1);
}

function preflight(env) {
  console.log("\n=== preflight (catch GCP 403/VPC-SC before apply) ===");
  const account = activeAccount();
  const member = iamMember(account);
  const project = readTfString(env, "project_id");
  const org = readTfString(env, "org_id");
  if (!account || !project) {
    console.error("preflight: gcloud is not authenticated or project_id is missing in tfvars.");
    process.exit(1);
  }
  console.log(`identity: ${member}`);

  const projectRoles = roleSet("project", project, member);
  requireCoveringRole(
    projectRoles,
    ["roles/logging.configWriter", "roles/logging.admin", "roles/owner"],
    "logging.sinks.create (04-security)"
  );
  requireCoveringRole(
    projectRoles,
    ["roles/resourcemanager.projectIamAdmin", "roles/owner"],
    "project IAM policy updates (01-iam)"
  );

  if (readTfBool(env, "create_access_policy") && org) {
    const orgRoles = roleSet("org", org, member);
    requireCoveringRole(
      orgRoles,
      ["roles/accesscontextmanager.policyAdmin"],
      "Access Policy create (03-vpcsc) — this is an org role, not project"
    );
  }

  const bucket = readStateBucket(env);
  if (bucket && !bucket.includes("your-gcp")) {
    const check = gcloudOut([
      "storage",
      "buckets",
      "describe",
      `gs://${bucket}`,
      "--format=value(name)",
    ]);
    if (check.status !== 0) {
      const err = `${check.stderr ?? ""}${check.stdout ?? ""}`;
      if (/vpcServiceControls/i.test(err)) {
        console.error(
          `preflight: VPC-SC blocked gs://${bucket} for ${member}. ` +
            `GitHub-hosted runners are outside the perimeter — add this identity to ingress, then re-run plan.\n${err.trim().slice(0, 400)}`
        );
        process.exit(1);
      }
      if (/403|PERMISSION_DENIED/i.test(err)) {
        console.error(
          `preflight: cannot describe gs://${bucket} as ${member} (IAM). Grant storage.admin or storage.objectViewer.\n${err.trim().slice(0, 400)}`
        );
        process.exit(1);
      }
    } else {
      console.log(`state bucket: gs://${bucket} reachable`);
    }
  }
  console.log("preflight ok");
}

function ensureStateBucket(env) {
  const bucket = readStateBucket(env);
  if (!bucket || bucket.includes("your-gcp")) return;
  const check = spawnSync(
    "gcloud",
    ["storage", "buckets", "describe", `gs://${bucket}`, "--format=value(name)"],
    { encoding: "utf-8" }
  );
  if (check.status === 0) return;
  const err = `${check.stderr ?? ""}${check.stdout ?? ""}`;
  if (/403|PERMISSION_DENIED|vpcServiceControls/i.test(err)) {
    console.error(
      `Cannot access gs://${bucket} as ${activeAccount() || "current identity"}. ` +
        `VPC-SC/IAM is blocking Terraform state (this is the GitHub runner, outside the perimeter). ` +
        `Add this SA to the service perimeter ingress, then re-run plan.\n${err.trim().slice(0, 500)}`
    );
    process.exit(1);
  }
  const loc = process.env.TF_STATE_BUCKET_LOCATION ?? "asia-south1";
  console.log(`Creating state bucket gs://${bucket}`);
  run("gcloud", [
    "storage",
    "buckets",
    "create",
    `gs://${bucket}`,
    `--location=${loc}`,
    "--uniform-bucket-level-access",
    "--public-access-prevention",
  ]);
}

const [command, env = "dev"] = process.argv.slice(2);

if (command === "fmt") {
  run("terraform", ["fmt", "-recursive", path.join(REPO, "terraform")]);
  process.exit(0);
}

if (!["init", "validate", "plan", "apply", "preflight"].includes(command)) {
  console.error("Usage: node scripts/terraform-stacks.mjs <init|fmt|validate|preflight|plan|apply> [dev]");
  process.exit(1);
}

if (command === "preflight") {
  preflight(env);
  process.exit(0);
}

if (command === "validate") {
  for (const stack of STACKS) {
    const dir = stackDir(env, stack);
    console.log(`\n=== validate ${stack} ===`);
    run("terraform", ["init", "-backend=false", "-input=false"], dir);
    run("terraform", ["validate"], dir);
  }
  process.exit(0);
}

if (command === "init") {
  ensureStateBucket(env);
  for (const stack of STACKS) {
    const dir = stackDir(env, stack);
    const backend = path.join(dir, "backend.hcl");
    console.log(`\n=== init ${stack} ===`);
    run("terraform", ["init", "-reconfigure", "-backend-config", backend], dir);
  }
  process.exit(0);
}

const STACK_DEPS = {
  "00-foundation": [],
  "01-iam": [{ prefix: "banking/dev/00-foundation", keys: ["state_bucket_name"] }],
  "02-network": [{ prefix: "banking/dev/00-foundation", keys: ["apis_enabled"] }],
  "03-vpcsc": [{ prefix: "banking/dev/01-iam", keys: ["ci_service_account_email"] }],
  "04-security": [{ prefix: "banking/dev/00-foundation", keys: ["audit_logs_bucket_name"] }],
  "05-platform": [
    { prefix: "banking/dev/00-foundation", keys: ["gke_key_id"] },
    { prefix: "banking/dev/02-network", keys: ["network_name"] },
  ],
  "06-data": [
    { prefix: "banking/dev/00-foundation", keys: ["sql_key_id"] },
    { prefix: "banking/dev/02-network", keys: ["network_id"] },
    { prefix: "banking/dev/05-platform", keys: ["workload_service_account_email"] },
  ],
};

function remoteOutputsReady(bucket, prefix, keys) {
  const res = spawnSync(
    "gcloud",
    ["storage", "cat", `gs://${bucket}/${prefix}/default.tfstate`],
    { encoding: "utf-8" }
  );
  if (res.status !== 0 || !res.stdout) return false;
  try {
    const outputs = JSON.parse(res.stdout).outputs ?? {};
    return keys.every((k) => outputs[k]?.value != null && outputs[k].value !== "");
  } catch {
    return false;
  }
}

if (command === "plan" || command === "apply") {
  preflight(env);
  ensureStateBucket(env);
  const planRoot = process.env.TF_PLAN_DIR ?? path.join(REPO, ".terraform-plan", env);
  mkdirSync(planRoot, { recursive: true });
  const vars = extraVarFiles(env);
  const bucket = readStateBucket(env);

  for (const stack of STACKS) {
    const deps = STACK_DEPS[stack] ?? [];
    const missing = deps.filter((d) => !remoteOutputsReady(bucket, d.prefix, d.keys));
    if (missing.length) {
      const msg = `${stack}: waiting on applied state ${missing.map((d) => d.prefix).join(", ")}`;
      if (command === "plan") {
        console.warn(`\n=== skip plan ${msg} ===`);
        continue;
      }
      console.error(`\n=== cannot apply ${msg} ===`);
      process.exit(1);
    }
    if (stack === "06-data" && !process.env.TF_VAR_database_password) {
      if (command === "plan") {
        process.env.TF_VAR_database_password = "ci-plan-placeholder";
        console.warn("TF_VAR_database_password unset — using placeholder for plan only.");
      } else {
        console.error("Set TF_VAR_database_password for stack 06-data (Cloud SQL user banking_app).");
        process.exit(1);
      }
    }
    const dir = stackDir(env, stack);
    const backend = path.join(dir, "backend.hcl");
    const planFile = path.join(planRoot, `${stack}.tfplan`);
    console.log(`\n=== ${command} ${stack} ===`);
    run("terraform", ["init", "-reconfigure", "-backend-config", backend], dir);

    if (command === "plan") {
      run("terraform", ["plan", "-input=false", "-out", planFile, ...vars], dir);
      continue;
    }

    if (!existsSync(planFile)) {
      run("terraform", ["plan", "-input=false", "-out", planFile, ...vars], dir);
    }
    run("terraform", ["apply", "-input=false", planFile], dir);
  }
}
