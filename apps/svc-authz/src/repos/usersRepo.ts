import { db, firestoreConverter } from '../data/firestore';
import { User } from '../domain/types';

const COLLECTION = 'users';

export class UsersRepo {
  private collection = db
    .collection(COLLECTION)
    .withConverter(firestoreConverter<User>());

  async get(uid: string): Promise<User | undefined> {
    const doc = await this.collection.doc(uid).get();
    return doc.exists ? doc.data() : undefined;
  }

  async upsert(u: User): Promise<void> {
    await this.collection.doc(u.uid).set(u, { merge: true });
  }

  async update(uid: string, patch: Partial<User>): Promise<void> {
    await this.collection.doc(uid).update(patch);
  }
}
