import { createHmac, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';

export interface StoredState {
  shop: string;
  createdAt: string;
  expiresAt: number;
}

export interface StateStoreOptions {
  filePath: string;
  ttlMs: number;
  hmacSecret: string;
}

interface StateFilePayload {
  version: 1;
  data: Record<string, StoredState>;
}

export class StateStore {
  private readonly ttlMs: number;
  private readonly hmacSecret: string;
  private readonly filePath: string;
  private readonly stateMap = new Map<string, StoredState>();
  private ready: Promise<void> | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(options: StateStoreOptions) {
    this.ttlMs = options.ttlMs;
    this.hmacSecret = options.hmacSecret;
    this.filePath = options.filePath;
  }

  async generate(
    shop: string,
    now = Date.now()
  ): Promise<{ state: string; expiresAt: number }> {
    await this.ensureLoaded();
    this.pruneExpired(now);

    const nonce = randomBytes(32).toString('hex');
    const signature = createHmac('sha256', this.hmacSecret)
      .update(nonce)
      .digest('hex');
    const state = `${nonce}.${signature}`;
    const expiresAt = now + this.ttlMs;

    const stored: StoredState = {
      shop,
      createdAt: new Date(now).toISOString(),
      expiresAt,
    };

    this.stateMap.set(state, stored);
    await this.persist();

    return { state, expiresAt };
  }

  async consume(state: string, now = Date.now()): Promise<StoredState | null> {
    await this.ensureLoaded();
    this.pruneExpired(now);

    const stored = this.stateMap.get(state);
    if (!stored) {
      return null;
    }

    if (stored.expiresAt <= now) {
      this.stateMap.delete(state);
      await this.persist();
      return null;
    }

    this.stateMap.delete(state);
    await this.persist();
    return stored;
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.ready) {
      this.ready = this.loadFromDisk();
    }
    return this.ready;
  }

  private pruneExpired(now: number): void {
    let removed = false;
    for (const [state, entry] of this.stateMap.entries()) {
      if (entry.expiresAt <= now) {
        this.stateMap.delete(state);
        removed = true;
      }
    }

    if (removed) {
      void this.persist();
    }
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as StateFilePayload;
      if (
        parsed.version !== 1 ||
        typeof parsed.data !== 'object' ||
        parsed.data === null
      ) {
        return;
      }

      const now = Date.now();
      for (const [state, entry] of Object.entries(parsed.data)) {
        if (entry.expiresAt > now) {
          this.stateMap.set(state, entry);
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private persist(): Promise<void> {
    this.writeChain = this.writeChain.then(async () => {
      const data: StateFilePayload = {
        version: 1,
        data: Object.fromEntries(this.stateMap.entries()),
      };

      const serialized = JSON.stringify(data, null, 2);
      await fs.mkdir(dirname(this.filePath), { recursive: true });
      const tempPath = `${this.filePath}.tmp`;
      await fs.writeFile(tempPath, serialized, 'utf8');
      await fs.rename(tempPath, this.filePath);
    });

    return this.writeChain;
  }
}
