import { db, firestoreConverter } from '../data/firestore';
import { Tenant, Ulid } from '../domain/types';

const COLLECTION = 'tenants';

export class TenantsRepo {
  private collection = db
    .collection(COLLECTION)
    .withConverter(firestoreConverter<Tenant>());

  async get(tenantId: Ulid): Promise<Tenant | undefined> {
    const doc = await this.collection.doc(tenantId).get();
    return doc.exists ? doc.data() : undefined;
  }

  async set(tenant: Tenant): Promise<void> {
    await this.collection.doc(tenant.tenantId).set(tenant);
  }

  async update(tenantId: Ulid, patch: Partial<Tenant>): Promise<void> {
    await this.collection.doc(tenantId).update(patch);
  }

  async delete(tenantId: Ulid): Promise<void> {
    await this.collection.doc(tenantId).delete();
  }
}
