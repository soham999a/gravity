import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

function cleanPrivateKey(raw: string | undefined): string {
  if (!raw) return "";
  // Strip surrounding quotes that Vercel or .env parsers may include
  let key = raw.replace(/^"|"$/g, "");
  // Convert literal \n to real newlines
  key = key.replace(/\\n/g, "\n");
  return key.trim();
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = cleanPrivateKey(process.env.FIREBASE_PRIVATE_KEY);

if (!projectId || !clientEmail || !privateKey) {
  console.error("[firebase-admin] Missing credentials:", {
    projectId: Boolean(projectId),
    clientEmail: Boolean(clientEmail),
    privateKey: Boolean(privateKey),
  });
}

const firebaseAdminConfig = {
  credential: cert({
    projectId,
    clientEmail,
    privateKey,
  }),
};

const adminApp = getApps().length === 0 ? initializeApp(firebaseAdminConfig) : getApps()[0]!;

export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
