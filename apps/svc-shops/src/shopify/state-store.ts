import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface OAuthStateRecord {
  state: string;
  shop: string;
  nonce: string;
  createdAt: string;
}

export interface OAuthStateStoreOptions {
  filePath: string;
  ttlSeconds: number;
  signingSecret: string;
}

export interface OAuthStateStore {
  create(shop: string): Promise<OAuthStateRecord>;
  consume(state: string): Promise<OAuthStateRecord | null>;
}

interface PersistedState {
  state: string;
  shop: string;
  nonce: string;
  createdAt: string;
}

export class FileOAuthStateStore implements OAuthStateStore {
  private readonly states = new Map<string, OAuthStateRecord>();
  private readonly ttlMs: number;

  constructor(private readonly options: OAuthStateStoreOptions) {
    this.ttlMs = options.ttlSeconds * 1000;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.states.size > 0) {
      return;
    }

    try {
      const data = await readFile(this.options.filePath, 'utf8');
      const parsed = JSON.parse(data) as PersistedState[];
      const now = Date.now();

      for (const record of parsed) {
        const createdAt = Date.parse(record.createdAt);
        if (Number.isNaN(createdAt) || now - createdAt > this.ttlMs) {
          continue;
        }

        this.states.set(record.state, record);
      }
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private sign(payload: string): string {
    const hmac = createHmac('sha256', this.options.signingSecret);
    hmac.update(payload);
    return hmac.digest('hex');
  }

  private verify(state: string): boolean {
    const [encodedPayload, signature] = state.split('.', 2);
    if (!encodedPayload || !signature) {
      return false;
    }

    const expected = this.sign(encodedPayload);
    const received = signature.toLowerCase();

    try {
      return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
    } catch {
      return false;
    }
  }

  async create(shop: string): Promise<OAuthStateRecord> {
    await this.ensureLoaded();

    const nonce = randomBytes(16).toString('hex');
    const createdAt = new Date().toISOString();
    const payload = Buffer.from(
      JSON.stringify({ shop, nonce, createdAt })
    ).toString('base64url');
    const signature = this.sign(payload);
    const state = `${payload}.${signature}`;

    const record: OAuthStateRecord = { state, shop, nonce, createdAt };
    this.states.set(state, record);
    await this.persist();

    return record;
  }

  async consume(state: string): Promise<OAuthStateRecord | null> {
    await this.ensureLoaded();

    if (!this.verify(state)) {
      return null;
    }

    const record = this.states.get(state);
    if (!record) {
      return null;
    }

    const createdAt = Date.parse(record.createdAt);
    if (Number.isNaN(createdAt) || Date.now() - createdAt > this.ttlMs) {
      this.states.delete(state);
      await this.persist();
      return null;
    }

    this.states.delete(state);
    await this.persist();

    return record;
  }

  private async persist(): Promise<void> {
    const dir = path.dirname(this.options.filePath);
    await mkdir(dir, { recursive: true });

    const payload: PersistedState[] = Array.from(this.states.values()).map((record) => ({
      state: record.state,
      shop: record.shop,
      nonce: record.nonce,
      createdAt: record.createdAt,
    }));

    await writeFile(this.options.filePath, JSON.stringify(payload, null, 2), 'utf8');
  }
}

export const createFileOAuthStateStore = (options: OAuthStateStoreOptions): OAuthStateStore =>
  new FileOAuthStateStore(options);
