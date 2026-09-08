// Offline SQL generation: no credentials are read and no database connection is initialized.
require('reflect-metadata');
const fs = require('node:fs');
const path = require('node:path');
const { DataSource, Table, TableForeignKey } = require('typeorm');
(async () => {
  const root = path.resolve(__dirname, '..');
  const dist = path.join(root, 'dist');
  const files = fs.readdirSync(dist, { recursive: true }).filter(file => file.endsWith('.entity.js'));
  const entities = files.flatMap(file => Object.values(require(path.join(dist, file))).filter(value => typeof value === 'function'));
  const db = new DataSource({ type: 'postgres', schema: 'public', uuidExtension: 'pgcrypto', entities });
  await db.buildMetadatas();
  const runner = db.createQueryRunner();
  runner.query = () => { throw new Error('SQL exporter must never query a database'); };
  const sql = ['BEGIN;'];
  const newTables = new Set(['notifications', 'storage_deletions', 'request_templates', 'rate_limit_buckets', 'staff_invitations']);
  const upgrade = ['BEGIN;'];
  const foreignKeys = [];
  const enumNames = new Set();
  for (const meta of db.entityMetadatas) {
    const table = Table.create(meta, db.driver);
    for (const column of table.columns.filter(c => c.enum)) {
      const enumName = runner.buildEnumName(table, column);
      if (!enumNames.has(enumName)) { sql.push(runner.createEnumTypeSql(table, column).query + ';'); enumNames.add(enumName); }
    }
    const create = runner.createTableSql(table, false).query + ';';
    sql.push(create);
    if (newTables.has(meta.tableName)) upgrade.push(create.replace('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS '));
    for (const index of table.indices) {
      const statement = runner.createIndexSql(table, index).query + ';'; sql.push(statement);
      if (newTables.has(meta.tableName)) upgrade.push(statement.replace('CREATE INDEX ', 'CREATE INDEX IF NOT EXISTS '));
    }
    for (const fk of meta.foreignKeys) foreignKeys.push(runner.createForeignKeySql(table, TableForeignKey.create(fk, db.driver)).query + ';');
  }
  sql.push(...foreignKeys, 'COMMIT;');
  upgrade.push(`ALTER TABLE portal_otps ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;`,
    `UPDATE portal_otps SET used = true WHERE length(code) <> 64;`,
    `ALTER TABLE document_requests ADD COLUMN IF NOT EXISTS "sentAt" timestamptz;`,
    `ALTER TABLE document_requests ADD COLUMN IF NOT EXISTS "portalExpiresAt" timestamptz;`,
    `ALTER TABLE document_requests ADD COLUMN IF NOT EXISTS "reminderScheduleHours" jsonb NOT NULL DEFAULT '[24,72,168]'::jsonb;`,
    'COMMIT;');
  const dir = path.join(root, 'database'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '001-initial-schema.sql'), '-- Empty database only. Generated from current entities; review before applying.\n' + sql.join('\n\n') + '\n');
  fs.writeFileSync(path.join(dir, '002-existing-checkout-upgrade.sql'), '-- Existing pre-migration FeedbackWell database only; back up and review first.\n' + upgrade.join('\n\n') + '\n');
  console.log(`Exported ${db.entityMetadatas.length} tables without connecting to a database.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
