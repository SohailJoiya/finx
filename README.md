# Drizzle + MySQL Migration Starter

This folder contains ready-to-use Drizzle schema and example controller rewrites to help you migrate your Node/Express app from MongoDB/Mongoose to MySQL using Drizzle ORM.

## 1) Install dependencies
```bash
npm i -D drizzle-kit typescript ts-node
npm i drizzle-orm mysql2 bcryptjs
```

## 2) Env
Copy `.env.example.mysql` into your `.env` and set the MySQL creds.

## 3) Generate SQL migrations and apply
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

This will create the tables defined in `src/db/schema.ts`.

## 4) Build TS to JS (or run with ts-node)
```bash
npx tsc --init              # if you don't have tsconfig.json
npx tsc                     # compile TS to ./dist
```

Update your app bootstrap to use the Drizzle client (`src/dbjs/index.js` expects built files under `dist` by default).

## 5) Switch controllers gradually
- Start by rewriting deposit & auth controllers as examples provided:
  - `src/controllers/depositController.drizzle.ts`
  - `src/controllers/authController.drizzle.ts`
- Replace Mongoose usage with Drizzle queries.
- Swap `req.user._id` (Mongo) with `req.user.id` (SQL). When you mint JWTs, encode `id` from SQL.

## 6) One-time data migration (optional)
If you have existing Mongo data, run the script:
```bash
npx ts-node scripts/migrateMongoToMysql.ts
```
It copies documents into SQL tables and preserves the mapping by storing each user's legacy Mongo `_id` in `users.mongo_id`. Relationships are remapped to new numeric ids.

## 7) Remove Mongoose bootstrapping
- Delete usages of `mongoose` and `src/config/db.js`.
- Create a new `src/config/db.mysql.ts` that imports the Drizzle `db` (or reuse `src/db/client.ts`).

## Notes
- Decimal columns are strings in JS by default. Convert to Number only when safe.
- Add indexes as needed (some useful ones are already included).
- For complex aggregations you used in Mongo `.aggregate()`, consider:
  - SQL `GROUP BY` via Drizzle
  - or create materialized rollups updated by cron/queue.
