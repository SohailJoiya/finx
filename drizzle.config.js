/** @type {import("drizzle-kit").Config} */
export default {
  schema: './src/db/schema.js',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: {
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    // 👇 only include password if present
    ...(process.env.MYSQL_PASSWORD
      ? {password: process.env.MYSQL_PASSWORD}
      : {}),
    database: process.env.MYSQL_DB
  },
  verbose: true,
  strict: true
}
