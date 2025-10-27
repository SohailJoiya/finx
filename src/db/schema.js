import {
  mysqlTable,
  int,
  bigint,
  varchar,
  text,
  boolean,
  decimal,
  datetime,
  index
} from 'drizzle-orm/mysql-core'
import {sql} from 'drizzle-orm'

// Example for deposits table:
export const deposits = mysqlTable(
  'deposits',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('user_id').notNull(),
    amount: decimal('amount', {precision: 18, scale: 2}).notNull(),
    transactionId: varchar('transaction_id', {length: 128}),
    screenshot: varchar('screenshot', {length: 512}).notNull(),
    status: varchar('status', {length: 16}).notNull().default('Pending'),
    adminReason: varchar('admin_reason', {length: 512}).notNull().default(''),
    createdAt: datetime('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`)
  },
  t => ({
    userIdx: index('idx_deposits_user').on(t.userId)
  })
)
