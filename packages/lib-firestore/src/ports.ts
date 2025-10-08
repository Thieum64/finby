export type DocKey = string;

export type Document<T = Record<string, unknown>> = {
  key: DocKey;
  data: T;
};

export type WhereOp = '==' | '>=' | '<=' | 'in' | 'array-contains';
export type OrderDir = 'asc' | 'desc';

export type QuerySpec = {
  collection: string;
  where?: Array<{ field: string; op: WhereOp; value: unknown }>;
  orderBy?: Array<{ field: string; dir: OrderDir }>;
  limit?: number;
};

export interface Repository<T = Record<string, unknown>> {
  get(key: DocKey): Promise<T | undefined>;
  set(key: DocKey, val: T, opts?: { merge?: boolean }): Promise<void>;
  update(key: DocKey, patch: Partial<T>): Promise<void>;
  delete(key: DocKey): Promise<void>;
  query(spec: QuerySpec): Promise<Array<Document<T>>>;
}

export interface TxRepository<T = Record<string, unknown>> {
  get(key: DocKey): Promise<T | undefined>;
  set(key: DocKey, val: T, opts?: { merge?: boolean }): Promise<void>;
  update(key: DocKey, patch: Partial<T>): Promise<void>;
  delete(key: DocKey): Promise<void>;
}

export interface TransactionPort {
  run<R>(
    fn: <T>(repo: <U>(repoImpl: Repository<U>) => TxRepository<U>) => Promise<R>
  ): Promise<R>;
}
