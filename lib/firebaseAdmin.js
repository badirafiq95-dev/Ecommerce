import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import fs from "node:fs";
import path from "node:path";
import { FIREBASE_PROJECT_ID } from "./firebaseProject";

let adminApp;

function getExpectedProjectId() {
  const configuredProjectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    FIREBASE_PROJECT_ID;

  if (configuredProjectId !== FIREBASE_PROJECT_ID) {
    throw new Error(
      `Firebase Admin project mismatch. Expected "${FIREBASE_PROJECT_ID}" but env points to "${configuredProjectId}".`
    );
  }

  return configuredProjectId;
}

function assertServiceAccountProject(serviceAccount, source) {
  const expectedProjectId = getExpectedProjectId();
  const serviceProjectId = serviceAccount?.project_id;
  const clientEmail = String(serviceAccount?.client_email || "");

  if (serviceProjectId && serviceProjectId !== expectedProjectId) {
    throw new Error(
      `Firebase Admin service account mismatch in ${source}. Expected project "${expectedProjectId}" but service account is for "${serviceProjectId}". Replace the service account with one from project "${expectedProjectId}".`
    );
  }

  if (
    clientEmail.endsWith(".iam.gserviceaccount.com") &&
    !clientEmail.includes(`@${expectedProjectId}.iam.gserviceaccount.com`)
  ) {
    throw new Error(
      `Firebase Admin client email mismatch in ${source}. Expected a service account from "${expectedProjectId}" but got "${clientEmail}".`
    );
  }

  return expectedProjectId;
}

function readLocalServiceAccount() {
  if (process.env.NODE_ENV === "production") return null;

  const filePath = path.join(process.cwd(), "firebase-service-account.json");
  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function getServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return {
      account: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
      source: "FIREBASE_SERVICE_ACCOUNT_JSON"
    };
  }

  if (
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
    process.env.FIREBASE_ADMIN_PRIVATE_KEY
  ) {
    return {
      account: {
        project_id: process.env.FIREBASE_ADMIN_PROJECT_ID,
        client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n")
      },
      source: "FIREBASE_ADMIN_* environment variables"
    };
  }

  const localAccount = readLocalServiceAccount();
  return localAccount
    ? { account: localAccount, source: "firebase-service-account.json" }
    : null;
}

export function getAdminApp() {
  if (adminApp) return adminApp;
  const expectedProjectId = getExpectedProjectId();
  if (getApps().length) {
    const existingApp = getApps()[0];
    if (existingApp.options.projectId && existingApp.options.projectId !== expectedProjectId) {
      throw new Error(
        `Firebase Admin app is already initialized for "${existingApp.options.projectId}", expected "${expectedProjectId}". Restart the Next.js server after replacing old Firebase credentials.`
      );
    }
    adminApp = existingApp;
    return adminApp;
  }

  const serviceAccountConfig = getServiceAccount();
  if (!serviceAccountConfig) {
    throw new Error("Firebase Admin credentials are missing");
  }

  const projectId = assertServiceAccountProject(serviceAccountConfig.account, serviceAccountConfig.source);
  adminApp = initializeApp({
    credential: cert(serviceAccountConfig.account),
    projectId
  });
  return adminApp;
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export { FieldValue };
