// Lightweight JS shim to use Drizzle in existing CommonJS code
// Requires ts-node/register in dev or compiled JS in build step.
const { db } = require('../dist/db/client.js'); // after build
const schema = require('../dist/db/schema.js');
module.exports = { db, schema };
