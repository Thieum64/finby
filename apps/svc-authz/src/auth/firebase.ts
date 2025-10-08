import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin SDK once
let initialized = false;

export function initFirebase(): void {
  if (initialized || getApps().length > 0) {
    return;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID environment variable is required');
  }

  initializeApp({
    credential: applicationDefault(),
    projectId,
  });

  initialized = true;
}

export interface TokenPayload {
  uid: string;
  email?: string;
}

export async function verifyIdToken(
  bearerOrToken: string
): Promise<TokenPayload> {
  initFirebase();

  // Remove "Bearer " prefix if present
  const token = bearerOrToken.startsWith('Bearer ')
    ? bearerOrToken.slice(7)
    : bearerOrToken;

  const decoded = await getAuth().verifyIdToken(token);

  return {
    uid: decoded.uid,
    email: decoded.email,
  };
}
