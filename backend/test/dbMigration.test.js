const test = require('node:test');
const assert = require('node:assert/strict');

const { pool, MIGRATIONS, assertMigrationVersions, assertSqlIdent } = require('../src/config/db');

test.after(async () => {
  await pool.end();
});

test('shipped migrations use unique, strictly increasing versions', () => {
  assert.doesNotThrow(() => assertMigrationVersions(MIGRATIONS));
  assert.equal(MIGRATIONS[0].version, 1);
  assert.equal(MIGRATIONS[MIGRATIONS.length - 1].version, MIGRATIONS.length);
  const descriptions = new Set(MIGRATIONS.map((migration) => migration.description));
  assert.equal(descriptions.size, MIGRATIONS.length);
});

test('duplicate or unsorted versions are rejected before any SQL runs', () => {
  const valid = { description: 'example', up: async () => {} };
  assert.throws(() => assertMigrationVersions([{ ...valid, version: 1 }, { ...valid, version: 1 }]), /duplicate version/);
  assert.throws(() => assertMigrationVersions([{ ...valid, version: 2 }, { ...valid, version: 1 }]), /strictly increase/);
  assert.throws(() => assertMigrationVersions([{ ...valid, version: 0 }]), /invalid version/);
  assert.throws(() => assertMigrationVersions([{ version: 1, description: '   ', up: async () => {} }]), /missing a description/);
});

test('database name must be a plain identifier', () => {
  assert.throws(() => assertSqlIdent('were`wolf'), /unsafe SQL identifier/);
  assert.throws(() => assertSqlIdent('were wolf'), /unsafe SQL identifier/);
  assert.doesNotThrow(() => assertSqlIdent('werewolf'));
});
