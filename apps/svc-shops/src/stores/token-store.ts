import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface ShopifyTokenRecord {
  shop: string;
  accessToken: string;
  scope: string;
  installedAt: string;
}

export interface TokenStore {
  save(record: ShopifyTokenRecord): Promise<void>;
  get(shop: string): Promise<ShopifyTokenRecord | undefined>;
  list(): Promise<ShopifyTokenRecord[]>;
}

interface PersistedToken {
  shop: string;
  accessToken: string;
  scope: string;
  installedAt: string;
}

export class FileTokenStore implements TokenStore {
  private readonly tokens = new Map<string, ShopifyTokenRecord>();
  private loaded = false;

  constructor(private readonly filePath: string) {}

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }

    try {
      const data = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(data) as PersistedToken[];
      for (const token of parsed) {
        this.tokens.set(token.shop, token);
      }
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    this.loaded = true;
  }

  async save(record: ShopifyTokenRecord): Promise<void> {
    await this.ensureLoaded();

    const normalized: ShopifyTokenRecord = {
      shop: record.shop,
      accessToken: record.accessToken,
      scope: record.scope,
      installedAt: record.installedAt,
    };

    this.tokens.set(normalized.shop, normalized);
    await this.persist();
  }

  async get(shop: string): Promise<ShopifyTokenRecord | undefined> {
    await this.ensureLoaded();
    return this.tokens.get(shop);
  }

  async list(): Promise<ShopifyTokenRecord[]> {
    await this.ensureLoaded();
    return Array.from(this.tokens.values());
  }

  private async persist(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await mkdir(dir, { recursive: true });

    const payload: PersistedToken[] = Array.from(this.tokens.values());
    await writeFile(this.filePath, JSON.stringify(payload, null, 2), 'utf8');
  }
}

export const createFileTokenStore = (filePath: string): TokenStore =>
  new FileTokenStore(filePath);
