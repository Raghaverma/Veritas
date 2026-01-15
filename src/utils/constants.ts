export const CACHE_TTL = {
  MINUTE: 60,
  HOUR: 3600, // 60 * MINUTE
  DAY: 86400, // 24 * HOUR
  HRS_12: 43200, // 12 * HOUR
};

export enum OrderByEnum {
  ASC = 'ASC',
  DESC = 'DESC',
}

export enum ActionType {
  READ = 'READ',
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}
