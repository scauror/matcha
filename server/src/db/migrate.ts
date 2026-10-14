import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = readdirSync(__dirname)
    .filter((f) => /^schema(\.sql|_.*\.sql)$/.test(f))
    .sort();

  for (const file of files) {
    const id = file === "schema.sql" ? "001" : file.replace(/^schema_|\.sql$/g, "");
    const { rowCount } = await pool.query(`SELECT 1 FROM schema_migrations WHERE id = $1`, [id]);
    if (rowCount) {
      console.log(`Skip ${id} (${file})`);
      continue;
    }
    const sql = readFileSync(join(__dirname, file), "utf8");
    await pool.query(sql);
    await pool.query(`INSERT INTO schema_migrations (id) VALUES ($1)`, [id]);
    console.log(`Applied ${id} (${file})`);
  }

  await pool.end();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
