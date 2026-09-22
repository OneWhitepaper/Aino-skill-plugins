import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { ROOT, buildCatalog } from "../scripts/build-catalog.mjs";

test("catalog builds with real sources and no fake plugins", async () => {
  const feed = await buildCatalog({ write: false });
  assert.equal(feed.entries.filter((entry) => entry.kind === "skill").length, 3);
  assert.equal(feed.entries.filter((entry) => entry.kind === "plugin").length, 0);
  for (const entry of feed.entries) {
    assert.match(entry.sourceSha256, /^[a-f0-9]{64}$/);
    assert.match(entry.sourceUrl, /^https:\/\/github\.com\//);
  }
});

test("generated catalog is committed and matches the source builder", async () => {
  const generated = JSON.parse(await readFile(`${ROOT}/catalog/catalog.json`, "utf8"));
  const current = await buildCatalog({ write: false });
  assert.deepEqual(generated.entries, current.entries);
  assert.equal(generated.schemaVersion, 1);
});

import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

async function fixture(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'aino-catalog-test-'));
  try {
    await cp(`${ROOT}/skills`, `${root}/skills`, { recursive: true });
    await cp(`${ROOT}/catalog.config.json`, `${root}/catalog.config.json`);
    await run(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}

test('source content and metadata edits change the revision deterministically', async () => {
  await fixture(async (root) => {
    const first = await buildCatalog({ root, write: false });
    assert.deepEqual(first, await buildCatalog({ root, write: false }));
    const file = `${root}/skills/research-brief/SKILL.md`;
    await writeFile(file, `${await readFile(file, 'utf8')}\nAdditional test instruction.\n`);
    const changed = await buildCatalog({ root, write: false });
    assert.notEqual(changed.revision, first.revision);
    const item = changed.entries.find((entry) => entry.name === 'research-brief');
    assert.equal(item.sourceSha256, createHash('sha256').update(await readFile(file)).digest('hex'));
    assert.ok(item.content.includes('Additional test instruction.'));
  });
});

test('invalid metadata and mismatched skill frontmatter prevent publication', async () => {
  await fixture(async (root) => {
    const file = `${root}/skills/research-brief/SKILL.md`;
    const original = await readFile(file, 'utf8');
    await writeFile(file, original.replace('name: research-brief', 'name: different-name'));
    await assert.rejects(buildCatalog({ root, write: false }), /mismatch/);
    await writeFile(file, original);
    const metadata = `${root}/skills/research-brief/catalog.json`;
    const data = JSON.parse(await readFile(metadata, 'utf8'));
    data.slug = '../outside';
    await writeFile(metadata, JSON.stringify(data));
    await assert.rejects(buildCatalog({ root, write: false }), /slug/);
  });
});

test('a real plugin entry needs a manifest, readme and matching name', async () => {
  await fixture(async (root) => {
    const folder = `${root}/plugins/fixture-plugin`;
    await mkdir(folder, { recursive: true });
    const metadata = JSON.parse(await readFile(`${ROOT}/skills/research-brief/catalog.json`, 'utf8'));
    Object.assign(metadata, { kind: 'plugin', name: 'fixture-plugin', slug: 'fixture-plugin' });
    await writeFile(`${folder}/catalog.json`, JSON.stringify(metadata));
    await assert.rejects(buildCatalog({ root, write: false }), /required/);
    await writeFile(`${folder}/plugin.yaml`, 'name: fixture-plugin\nversion: 1.0.0\n');
    await writeFile(`${folder}/README.md`, '# Fixture only\nNot a published plugin.');
    await writeFile(`${folder}/__init__.py`, 'def register(ctx):\n    pass\n');
    const feed = await buildCatalog({ root, write: false });
    const plugin = feed.entries.find((entry) => entry.kind === 'plugin');
    assert.equal(plugin.subdir, 'plugins/fixture-plugin');
    assert.ok(plugin.installCommand.includes('/tree/main/plugins/fixture-plugin'));
  });
});
