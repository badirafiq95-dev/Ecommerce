import fs from "node:fs";
import path from "node:path";

const EXPECTED_PROJECT_ID = "ecommerce-web-7fc55";
const LEGACY_PROJECT_ID = ["mint", "lane", "cards"].join("-");

function readDotEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return {};

  return fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .reduce((env, line) => {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      return env;
    }, {});
}

function readServiceAccountProject(env) {
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    return {
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      source: "FIREBASE_SERVICE_ACCOUNT_JSON"
    };
  }

  if (env.FIREBASE_ADMIN_PROJECT_ID || env.FIREBASE_ADMIN_CLIENT_EMAIL) {
    return {
      projectId: env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
      source: "FIREBASE_ADMIN_* env vars"
    };
  }

  const serviceAccountPath = path.join(process.cwd(), "firebase-service-account.json");
  if (!fs.existsSync(serviceAccountPath)) return null;
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
  return {
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email,
    source: "firebase-service-account.json"
  };
}

const env = { ...readDotEnvLocal(), ...process.env };
const serviceAccount = readServiceAccountProject(env);

const rows = [
  ["Expected Firebase project", EXPECTED_PROJECT_ID],
  ["NEXT_PUBLIC_FIREBASE_PROJECT_ID", env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "(missing)"],
  ["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "(missing)"],
  ["FIREBASE_ADMIN_PROJECT_ID", env.FIREBASE_ADMIN_PROJECT_ID || "(missing)"],
  ["Admin credential source", serviceAccount?.source || "(missing)"],
  ["Admin credential project", serviceAccount?.projectId || "(missing)"],
  ["Admin credential email", serviceAccount?.clientEmail || "(missing)"]
];

for (const [label, value] of rows) {
  console.log(`${label}: ${value}`);
}

const badValues = rows.filter(([, value]) => String(value).includes(LEGACY_PROJECT_ID));
const wrongProjectValues = rows.filter(([label, value]) => label.includes("project") && value !== "(missing)" && value !== EXPECTED_PROJECT_ID);

if (badValues.length || wrongProjectValues.length) {
  console.error("\nMismatch found. Replace old Firebase credentials/config with ecommerce-web-7fc55.");
  process.exit(1);
}

console.log("\nFirebase project config looks consistent.");
