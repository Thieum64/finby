import { db, firestoreConverter } from '../data/firestore';
import { Membership, Ulid } from '../domain/types';
import { membershipKey } from '@hp/lib-firestore';

const COLLECTION = 'memberships';

export class MembershipsRepo {
  private collection = db
    .collection(COLLECTION)
    .withConverter(firestoreConverter<Membership>());

  async get(tenantId: Ulid, uid: string): Promise<Membership | undefined> {
    const docId = membershipKey(tenantId, uid);
    const doc = await this.collection.doc(docId).get();
    return doc.exists ? doc.data() : undefined;
  }

  async set(m: Membership): Promise<void> {
    const docId = membershipKey(m.tenantId, m.uid);
    await this.collection.doc(docId).set(m);
  }

  async delete(tenantId: Ulid, uid: string): Promise<void> {
    const docId = membershipKey(tenantId, uid);
    await this.collection.doc(docId).delete();
  }

  async listTenantsByUid(
    uid: string
  ): Promise<Array<Pick<Membership, 'tenantId' | 'roles'>>> {
    const snapshot = await this.collection.where('uid', '==', uid).get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return { tenantId: data.tenantId, roles: data.roles };
    });
  }

  async listMembersByTenant(tenantId: Ulid): Promise<Membership[]> {
    const snapshot = await this.collection
      .where('tenantId', '==', tenantId)
      .get();
    return snapshot.docs.map((doc) => doc.data());
  }

  async getRoles(tenantId: Ulid, uid: string): Promise<string[] | null> {
    const membership = await this.get(tenantId, uid);
    return membership ? membership.roles : null;
  }

  async hasAccess(tenantId: Ulid, uid: string): Promise<boolean> {
    const roles = await this.getRoles(tenantId, uid);
    return roles !== null && roles.length > 0;
  }
}
