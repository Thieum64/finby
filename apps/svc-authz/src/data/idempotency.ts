import { idempotencyKeyHash } from '@hp/lib-common';
import { db, firestoreConverter } from './firestore.js';

export const IDEMPOTENCY_HEADER = 'x-idempotency-key';

const COLLECTION = 'idempotency';

interface IdempotencyRecord<T> {
  createdAt: string;
  uid: string;
  result: T;
  bodyHash?: string;
}

export class IdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdempotencyConflictError';
  }
}

export async function withIdempotency<T>(
  key: string,
  exec: () => Promise<T>,
  opts?: { uid?: string; bodyHash?: string }
): Promise<{ fromCache: boolean; result: T }> {
  const hash = idempotencyKeyHash(key);
  const collection = db
    .collection(COLLECTION)
    .withConverter(firestoreConverter<IdempotencyRecord<T>>());
  const docRef = collection.doc(hash);

  const doc = await docRef.get();
  if (doc.exists) {
    const data = doc.data();
    if (data) {
      // Check if bodyHash differs when provided
      if (opts?.bodyHash && data.bodyHash && opts.bodyHash !== data.bodyHash) {
        throw new IdempotencyConflictError(
          'idempotency-key reused with different payload'
        );
      }
      return { fromCache: true, result: data.result };
    }
  }

  const result = await exec();
  await docRef.set({
    createdAt: new Date().toISOString(),
    uid: opts?.uid ?? 'unknown',
    result,
    bodyHash: opts?.bodyHash,
  });

  return { fromCache: false, result };
}
