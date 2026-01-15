export type TtlCache<T extends Record<string, any> | null> = {
  func: (key: string, ttl: number) => Promise<T>;
  key: string;
  ttl?: number;
};

export interface HashTtlCache<T extends Record<string, any> | null> {
  func: (key: string, ttl: number) => Promise<T>;
  key: string;
  field: string;
  ttl?: number;
}
