import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface WebhookStore {
  has(id: string): Promise<boolean>;
  remember(id: string): Promise<void>;
}

interface PersistedWebhook {
  id: string;
  receivedAt: string;
}

export class FileWebhookStore implements WebhookStore {
  private readonly seen = new Map<string, string>();
  private loaded = false;

  constructor(private readonly filePath: string) {}

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }

    try {
      const data = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(data) as PersistedWebhook[];
      for (const entry of parsed) {
        this.seen.set(entry.id, entry.receivedAt);
      }
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    this.loaded = true;
  }

  async has(id: string): Promise<boolean> {
    await this.ensureLoaded();
    return this.seen.has(id);
  }

  async remember(id: string): Promise<void> {
    await this.ensureLoaded();

    this.seen.set(id, new Date().toISOString());
    await this.persist();
  }

  private async persist(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await mkdir(dir, { recursive: true });

    const payload: PersistedWebhook[] = Array.from(this.seen.entries()).map(([id, receivedAt]) => ({
      id,
      receivedAt,
    }));

    await writeFile(this.filePath, JSON.stringify(payload, null, 2), 'utf8');
  }
}

export const createFileWebhookStore = (filePath: string): WebhookStore =>
  new FileWebhookStore(filePath);
