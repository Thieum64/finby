import { db, firestoreConverter } from '../data/firestore.js';
import { Invitation } from '../domain/invitations.js';

const COLLECTION = 'invitations';

// Recommended index for future purge operations:
// Collection: invitations
// Fields: status (Ascending), expiresAt (Ascending)

export class InvitationsRepo {
  private collection = db
    .collection(COLLECTION)
    .withConverter(firestoreConverter<Invitation>());

  async getByToken(token: string): Promise<Invitation | null> {
    const doc = await this.collection.doc(token).get();
    return doc.exists ? (doc.data() ?? null) : null;
  }

  async create(inv: Invitation): Promise<void> {
    await this.collection.doc(inv.token).set(inv);
  }

  async markAccepted(token: string, uid: string, atIso: string): Promise<void> {
    await db.runTransaction(async (transaction) => {
      const docRef = this.collection.doc(token);
      const doc = await transaction.get(docRef);

      if (!doc.exists) {
        throw new Error('Invitation not found');
      }

      transaction.update(docRef, {
        status: 'ACCEPTED',
        acceptedAt: atIso,
        acceptedBy: uid,
      });
    });
  }

  async cancel(token: string, byUid: string, atIso: string): Promise<void> {
    await db.runTransaction(async (transaction) => {
      const docRef = this.collection.doc(token);
      const doc = await transaction.get(docRef);

      if (!doc.exists) {
        throw new Error('Invitation not found');
      }

      transaction.update(docRef, {
        status: 'CANCELED',
        acceptedAt: atIso,
        acceptedBy: byUid,
      });
    });
  }
}
