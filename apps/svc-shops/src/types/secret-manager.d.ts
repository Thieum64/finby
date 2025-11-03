declare module '@google-cloud/secret-manager' {
  export class SecretManagerServiceClient {
    constructor(options?: Record<string, unknown>);
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
  }
}
