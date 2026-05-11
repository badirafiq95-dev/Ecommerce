import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import fs from "node:fs";
import path from "node:path";

const FIREBASE_PROJECT_ID = "ecommerce-web-7fc55";

function readServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  if (
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
    process.env.FIREBASE_ADMIN_PRIVATE_KEY
  ) {
    return {
      project_id: process.env.FIREBASE_ADMIN_PROJECT_ID,
      client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n")
    };
  }

  const serviceAccountPath = path.join(process.cwd(), "firebase-service-account.json");
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error("Missing Firebase Admin credentials. Add firebase-service-account.json locally or set FIREBASE_SERVICE_ACCOUNT_JSON.");
  }

  return JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
}

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/set-admin-claim.mjs admin@example.com");
  process.exit(1);
}

const serviceAccount = readServiceAccount();
if (serviceAccount.project_id !== FIREBASE_PROJECT_ID) {
  throw new Error(
    `Wrong service account project. Expected "${FIREBASE_PROJECT_ID}" but got "${serviceAccount.project_id}". Download a new service account key from Firebase project "${FIREBASE_PROJECT_ID}".`
  );
}
initializeApp({
  credential: cert(serviceAccount),
  projectId: FIREBASE_PROJECT_ID
});

const user = await getAuth().getUserByEmail(email);
await getAuth().setCustomUserClaims(user.uid, { admin: true });
console.log(`Admin claim added for ${email}. Ask the user to sign out and sign in again.`);
