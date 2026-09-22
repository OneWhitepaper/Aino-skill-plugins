import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, lstat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SLUG = /^[a-z0-9][a-z0-9-]{1,63}$/;
const KINDS = new Set(["skill", "plugin"]);
const PLATFORMS = new Set(["macos", "windows", "linux"]);

const text = (value) => typeof value === "string" && value.trim() ? value.trim() : null;
const localized = (value, field) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${field} must contain zh and en strings.`);
  const zh = text(value.zh); const en = text(value.en);
  if (!zh || !en) throw new Error(`${field} must contain zh and en strings.`);
  return { zh, en };
};

async function filesIn(directory) {
  try { return await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
}

async function readJSON(file) {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) { throw new Error(`${path.relative(ROOT, file)} is not valid JSON: ${error.message}`); }
}

export function validateEntry(entry, relative, sourceFile) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`${relative}: metadata must be an object.`);
  if (!KINDS.has(entry.kind)) throw new Error(`${relative}: kind must be skill or plugin.`);
  if (!SLUG.test(entry.slug || "") || entry.slug !== path.basename(sourceFile)) throw new Error(`${relative}: slug must match its directory and use lowercase hyphenated text.`);
  if (entry.name !== entry.slug) throw new Error(`${relative}: name must match slug.`);
  const title = localized(entry.title, `${relative}.title`);
  const description = localized(entry.description, `${relative}.description`);
  if (!text(entry.category) || !Array.isArray(entry.tags) || !entry.tags.length || entry.tags.some((tag) => !text(tag))) throw new Error(`${relative}: category and non-empty tags are required.`);
  if (!Array.isArray(entry.platforms) || !entry.platforms.length || entry.platforms.some((platform) => !PLATFORMS.has(platform))) throw new Error(`${relative}: platforms must contain macos, windows or linux.`);
  if (!text(entry.author) || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(entry.version || "") || !text(entry.license)) throw new Error(`${relative}: author, semantic version and license are required.`);
  return { ...entry, title, description, tags: [...new Set(entry.tags.map((tag) => tag.trim().toLowerCase()))].sort(), platforms: [...new Set(entry.platforms)].sort() };
}

async function collectKind(kind, root, config) {
  const directory = path.join(root, `${kind}s`);
  const rows = [];
  for (const entry of await filesIn(directory)) {
    if (entry.isSymbolicLink()) throw new Error("Catalog source symlinks are not supported.");
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const folder = path.join(directory, entry.name);
    const metadataFile = path.join(folder, "catalog.json");
    const metadata = await readJSON(metadataFile);
    const source = kind === "skill" ? path.join(folder, "SKILL.md") : path.join(folder, "plugin.yaml");
    const info = await lstat(source).catch(() => null);
    if (!info?.isFile() || info.size === 0) throw new Error(`${path.relative(ROOT, folder)}: ${path.basename(source)} is required and must be non-empty.`);
    const normalized = validateEntry(metadata, path.relative(ROOT, metadataFile), folder);
    if (normalized.kind !== kind) throw new Error(`${path.relative(ROOT, metadataFile)}: kind does not match its directory.`);
    const raw = await readFile(source);
    let content = raw.toString("utf8");
    if (kind === "skill") {
      const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
      if (!frontmatter) throw new Error(`${source}: YAML frontmatter is required.`);
      const fields = Object.fromEntries(frontmatter[1].split(/\r?\n/).filter(Boolean).map((line) => {
        const match = /^(name|description):\s*(.*)$/.exec(line);
        return match ? [match[1], match[2].replace(/^['"]|['"]$/g, "")] : [line, ""];
      }));
      if (fields.name !== normalized.name || !text(fields.description) || Object.keys(fields).some((key) => !["name", "description"].includes(key))) throw new Error(`${source}: invalid YAML frontmatter or name/description mismatch.`);
      content = content.slice(frontmatter[0].length).trim();
    } else {
      const name = /^name:\s*([^\n]+)$/m.exec(content)?.[1]?.trim().replace(/^['"]|['"]$/g, "");
      if (name !== normalized.name) throw new Error(`${source}: invalid plugin manifest or name mismatch.`);
      content = await readFile(path.join(folder, "README.md"), "utf8");
      const implementation = (await filesIn(folder)).some((file) => file.isFile() && /\.(py|js|ts|mjs|cjs)$/.test(file.name));
      if (!implementation) throw new Error(`${source}: plugin implementation is required.`);
    }
    if (!content.trim()) throw new Error(`${source}: instructions are empty.`);
    const subdir = `${kind}s/${normalized.slug}`;
    const identifier = `${config.repository}/${subdir}`;
    const repo = `https://github.com/${config.repository}`;
    const pluginTarget = `${repo}/tree/${config.branch}/${subdir}`;
    rows.push({ ...normalized, source: "aino", content, identifier, repo, subdir, sourcePath: `${subdir}/${path.basename(source)}`, sourceUrl: `${repo}/blob/${config.branch}/${subdir}/${path.basename(source)}`, installCommand: kind === "skill" ? `hermes skills install ${identifier}` : `hermes plugins install ${pluginTarget}`, sourceSha256: createHash("sha256").update(raw).digest("hex") });
  }
  return rows;
}

export async function buildCatalog({ write = true, root = ROOT } = {}) {
  const config = await readJSON(path.join(root, "catalog.config.json"));
  if (config.repository !== "OneWhitepaper/Aino-skill-plugins" || config.branch !== "main" || config.schemaVersion !== 1) throw new Error("Unsupported catalog configuration.");
  const skills = await collectKind("skill", root, config);
  const plugins = await collectKind("plugin", root, config);
  const entries = [...skills, ...plugins].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  const revision = createHash("sha256").update(JSON.stringify(entries)).digest("hex");
  const payload = { schemaVersion: 1, revision, repository: config.repository, entries };
  if (write) {
    const directory = path.join(root, "catalog"); await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "catalog.json"), `${JSON.stringify(payload, null, 2)}\n`);
    await writeFile(path.join(directory, "skills.json"), `${JSON.stringify({ ...payload, entries: skills }, null, 2)}\n`);
    await writeFile(path.join(directory, "plugins.json"), `${JSON.stringify({ ...payload, entries: plugins }, null, 2)}\n`);
  }
  return payload;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const payload = await buildCatalog(); console.log(`Generated ${payload.entries.length} catalog entries (${payload.entries.filter((item) => item.kind === "skill").length} skills, ${payload.entries.filter((item) => item.kind === "plugin").length} plugins).`); }
  catch (error) { console.error(`Catalog build failed: ${error.message}`); process.exitCode = 1; }
}
