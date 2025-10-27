# Drizzle (MySQL) Migration Applied

- MongoDB connection and URI have been removed.
- Drizzle + MySQL client wired at `src/db/client.js`.
- Use `.env` (see `.env.example`) for DB creds.
- Run migrations:
  ```bash
  npm run drizzle:generate
  npm run drizzle:migrate
  ```
- Replace any remaining Mongoose model usage with Drizzle queries via `db` and tables in `src/db/schema.js`.
