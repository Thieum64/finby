import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';

export interface TokenRecord {
  shop: string;
  access_token: string;
  scope: string;
  installedAt: string;
}

export interface TokenStore {
  save(record: TokenRecord): Promise<void>;
  get(shop: string): Promise<TokenRecord | null>;
}

interface TokenFilePayload {
  version: 1;
  data: TokenRecord[];
}

export interface FileTokenStoreOptions {
  filePath: string;
}

export class FileTokenStore implements TokenStore {
  private readonly filePath: string;
  private readonly map = new Map<string, TokenRecord>();
  private ready: Promise<void> | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(options: FileTokenStoreOptions) {
    this.filePath = options.filePath;
  }

  async save(record: TokenRecord): Promise<void> {
    await this.ensureLoaded();
    this.map.set(record.shop, record);
    await this.persist();
  }

  async get(shop: string): Promise<TokenRecord | null> {
    await this.ensureLoaded();
    return this.map.get(shop) ?? null;
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.ready) {
      this.ready = this.loadFromDisk();
    }
    await this.ready;
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as TokenFilePayload;
      if (parsed.version !== 1 || !Array.isArray(parsed.data)) {
        return;
      }

      for (const record of parsed.data) {
        if (
          typeof record.shop === 'string' &&
          typeof record.access_token === 'string' &&
          typeof record.scope === 'string' &&
          typeof record.installedAt === 'string'
        ) {
          this.map.set(record.shop, record);
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
      const payload: TokenFilePayload = {
        version: 1,
        data: Array.from(this.map.values()),
      };

      await fs.mkdir(dirname(this.filePath), { recursive: true });
      const serialized = JSON.stringify(payload, null, 2);
      const tempPath = `${this.filePath}.tmp`;
      await fs.writeFile(tempPath, serialized, 'utf8');
      await fs.rename(tempPath, this.filePath);
    });

    return this.writeChain;
  }
}

type SecretManagerClientLike = {
  getSecret(request: { name: string }): Promise<unknown[]>;
  createSecret(request: {
    parent: string;
    secretId: string;
    secret: { replication: { automatic: Record<string, never> } };
  }): Promise<unknown[]>;
  addSecretVersion(request: {
    parent: string;
    payload: { data: Buffer };
  }): Promise<unknown[]>;
  accessSecretVersion(request: { name: string }): Promise<
    [
      {
        payload?: {
          data?: Buffer | Uint8Array | null;
        } | null;
      },
    ]
  >;
};

export interface SecretManagerTokenStoreOptions {
  projectId: string;
  client?: SecretManagerClientLike;
  clientFactory?: () => Promise<SecretManagerClientLike>;
}

const SECRET_PREFIX = 'shopify-shop-';
const SECRET_SUFFIX = '-access-token';

function toSecretId(shop: string): string {
  return `${SECRET_PREFIX}${shop.replace(/[^a-z0-9-]/g, '-')}${SECRET_SUFFIX}`;
}

export class SecretManagerTokenStore implements TokenStore {
  private readonly projectId: string;
  private readonly suppliedClient?: SecretManagerClientLike;
  private readonly clientFactory?: () => Promise<SecretManagerClientLike>;
  private cachedClient: SecretManagerClientLike | null = null;

  constructor(options: SecretManagerTokenStoreOptions) {
    this.projectId = options.projectId;
    this.suppliedClient = options.client;
    this.clientFactory = options.clientFactory;
  }

  async save(record: TokenRecord): Promise<void> {
    const secretId = toSecretId(record.shop);
    const parent = `projects/${this.projectId}`;
    const secretName = `${parent}/secrets/${secretId}`;

    const client = await this.getClient();
    await this.ensureSecretExists(client, parent, secretId);
    await client.addSecretVersion({
      parent: secretName,
      payload: {
        data: Buffer.from(JSON.stringify(record), 'utf8'),
      },
    });
  }

  async get(shop: string): Promise<TokenRecord | null> {
    const secretId = toSecretId(shop);
    const name = `projects/${this.projectId}/secrets/${secretId}/versions/latest`;

    try {
      const client = await this.getClient();
      const [version] = await client.accessSecretVersion({ name });
      const payload = version.payload?.data?.toString('utf8');
      if (!payload) {
        return null;
      }

      const record = JSON.parse(payload) as TokenRecord;
      if (
        typeof record.shop === 'string' &&
        typeof record.access_token === 'string' &&
        typeof record.scope === 'string' &&
        typeof record.installedAt === 'string'
      ) {
        return record;
      }

      return null;
    } catch (error) {
      if ((error as { code?: number }).code === 5) {
        // Not found
        return null;
      }
      throw error;
    }
  }

  private async ensureSecretExists(
    client: SecretManagerClientLike,
    parent: string,
    secretId: string
  ): Promise<void> {
    const name = `${parent}/secrets/${secretId}`;
    try {
      await client.getSecret({ name });
    } catch (error) {
      if ((error as { code?: number }).code !== 5) {
        throw error;
      }

      await client.createSecret({
        parent,
        secretId,
        secret: {
          replication: {
            automatic: {},
          },
        },
      });
    }
  }

  private async getClient(): Promise<SecretManagerClientLike> {
    if (this.cachedClient) {
      return this.cachedClient;
    }

    if (this.suppliedClient) {
      this.cachedClient = this.suppliedClient;
      return this.cachedClient;
    }

    if (this.clientFactory) {
      this.cachedClient = await this.clientFactory();
      return this.cachedClient;
    }

    try {
      const module = (await import('@google-cloud/secret-manager')) as {
        SecretManagerServiceClient: new () => SecretManagerClientLike;
      };
      this.cachedClient = new module.SecretManagerServiceClient();
      return this.cachedClient;
    } catch (error) {
      throw new Error(
        'Failed to load @google-cloud/secret-manager. Provide a clientFactory or ensure the dependency is installed.',
        { cause: error }
      );
    }
  }
}
