import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';

interface WebhookRecord {
  id: string;
  shop?: string | null;
  topic?: string | null;
  receivedAt: string;
}

interface WebhookFilePayload {
  version: 1;
  data: WebhookRecord[];
}

export interface WebhookStoreOptions {
  filePath: string;
  maxEntries?: number;
}

export class WebhookStore {
  private readonly filePath: string;
  private readonly maxEntries: number;
  private readonly records = new Map<string, WebhookRecord>();
  private ready: Promise<void> | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(options: WebhookStoreOptions) {
    this.filePath = options.filePath;
    this.maxEntries = options.maxEntries ?? 500;
  }

  async markHandled(
    id: string,
    metadata: { shop?: string | null; topic?: string | null },
    now = Date.now()
  ): Promise<boolean> {
    await this.ensureLoaded();

    if (this.records.has(id)) {
      return false;
    }

    const record: WebhookRecord = {
      id,
      shop: metadata.shop ?? null,
      topic: metadata.topic ?? null,
      receivedAt: new Date(now).toISOString(),
    };

    this.records.set(id, record);

    if (this.records.size > this.maxEntries) {
      const sorted = Array.from(this.records.values()).sort((a, b) =>
        a.receivedAt.localeCompare(b.receivedAt)
      );
      const excess = this.records.size - this.maxEntries;
      for (let i = 0; i < excess; i++) {
        this.records.delete(sorted[i].id);
      }
    }

    await this.persist();
    return true;
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
      const parsed = JSON.parse(raw) as WebhookFilePayload;
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.data)) {
        return;
      }

      for (const record of parsed.data) {
        if (
          typeof record.id === 'string' &&
          typeof record.receivedAt === 'string'
        ) {
          this.records.set(record.id, record);
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
      const payload: WebhookFilePayload = {
        version: 1,
        data: Array.from(this.records.values()),
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
