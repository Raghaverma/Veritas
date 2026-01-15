import { AnyColumn, sql, SQL } from 'drizzle-orm';
import { pgEnum, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';

export const statusType = pgEnum('status-type', ['active', 'inactive']);

export const increment = (column: AnyColumn, value = 1) => {
  return sql`${column}
  +
  ${value}`;
};

// Helper function for case-insensitive email indexing
export function lower(column: any): SQL {
  return sql`lower(
  ${column}
  )`;
}

export const users = pgTable('users', {
  _id: varchar('_id').primaryKey().notNull(),
  name: varchar('name'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow(),
});
