/**
 * Export FamTree tables from a local Postgres DB (after pg_restore) to JSON.
 *
 * Usage:
 *   set DATABASE_URL=postgresql://postgres:postgres@localhost:5433/famtree
 *   node scripts/migrate/export-from-postgres.mjs
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Client } = pg;
const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/famtree";

const outDir = path.resolve("scripts/migrate/output");
const outFile = path.join(outDir, "famtree-export.json");

const tables = [
  "clans",
  "profiles",
  "clan_memberships",
  "persons",
  "relationships",
  "person_positions",
  "branch_owners",
  "suggestions",
  "change_events",
];

const client = new Client({ connectionString });

const main = async () => {
  await client.connect();
  const exportData = { exportedAt: new Date().toISOString(), tables: {} };

  for (const table of tables) {
    const { rows } = await client.query(`select * from public.${table}`);
    exportData.tables[table] = rows;
    console.log(`  ${table}: ${rows.length} rows`);
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(exportData, null, 2));
  console.log(`\nWrote ${outFile}`);
  await client.end();
};

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
