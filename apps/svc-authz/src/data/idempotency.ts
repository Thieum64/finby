import { idempotencyKeyHash } from '@hp/lib-common';
import { db, firestoreConverter } from './firestore.js';

export const IDEMPOTENCY_HEADER = 'x-idempotency-key';

const COLLECTION = 'idempotency';

interface IdempotencyRecord<T> {
  createdAt: string;
  uid: string;
  result: T;
}

export async function withIdempotency<T>(
  key: string,
  uid: string,
  exec: () => Promise<T>
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
      return { fromCache: true, result: data.result };
    }
  }

  const result = await exec();
  await docRef.set({
    createdAt: new Date().toISOString(),
    uid,
    result,
  });

  return { fromCache: false, result };
}
