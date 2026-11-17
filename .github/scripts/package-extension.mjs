import { createHash } from 'node:crypto';
import { log } from 'node:console';
import {
  appendFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const distDirectory = path.join(workspace, 'dist');
const packageJson = JSON.parse(readFileSync(path.join(workspace, 'package.json'), 'utf8'));
const manifestPath = path.join(distDirectory, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const version = manifest.version;

if (version !== packageJson.version) {
  throw new Error(
    `Version mismatch: package.json is ${packageJson.version}, but dist/manifest.json is ${version}.`,
  );
}
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`The extension version is not a valid release version: ${version}`);
}

if (process.env.EVENT_NAME === 'release') {
  const releaseTag = process.env.RELEASE_TAG;
  if (releaseTag !== version && releaseTag !== `v${version}`) {
    throw new Error(
      `Release tag "${releaseTag}" must match extension version "${version}" (optionally prefixed with "v").`,
    );
  }
}

const requiredFiles = [
  'manifest.json',
  'background.js',
  'content.js',
  manifest.action?.default_popup,
  manifest.background?.service_worker,
  manifest.options_ui?.page,
  ...Object.values(manifest.icons ?? {}),
  ...Object.values(manifest.action?.default_icon ?? {}),
].filter(Boolean);

for (const file of requiredFiles) {
  if (!existsSync(path.join(distDirectory, file))) {
    throw new Error(`The built extension is missing a manifest-referenced file: ${file}`);
  }
}

function listFiles(directory, relativeDirectory = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(absolutePath, relativePath) : [relativePath];
  });
}

const builtFiles = listFiles(distDirectory);
const builtFileSet = new Set(builtFiles);

function resolveLocalReference(sourceFile, reference) {
  if (
    reference.startsWith('data:') ||
    reference.startsWith('http:') ||
    reference.startsWith('https:') ||
    reference.startsWith('#')
  ) {
    return null;
  }
  const withoutSuffix = reference.split(/[?#]/, 1)[0];
  return withoutSuffix.startsWith('/')
    ? withoutSuffix.slice(1)
    : path.posix.normalize(path.posix.join(path.posix.dirname(sourceFile), withoutSuffix));
}

for (const sourceFile of builtFiles) {
  const extension = path.posix.extname(sourceFile);
  if (!['.html', '.js', '.css'].includes(extension)) continue;

  const source = readFileSync(path.join(distDirectory, sourceFile), 'utf8');
  const references = [];
  if (extension === '.html') {
    for (const match of source.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
      references.push(match[1]);
    }
  } else if (extension === '.js') {
    for (const match of source.matchAll(
      /(?:^|[;\n])\s*import(?:\s*[^;'"]*?\s*from)?\s*["']([^"']+)["']/g,
    )) {
      references.push(match[1]);
    }
    for (const match of source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g)) {
      references.push(match[1]);
    }
  } else {
    for (const match of source.matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g)) {
      references.push(match[2]);
    }
  }

  for (const reference of references) {
    const localPath = resolveLocalReference(sourceFile, reference);
    if (localPath !== null && !builtFileSet.has(localPath)) {
      throw new Error(`${sourceFile} references a missing built asset: ${reference}`);
    }
  }
}

const archiveName = `typadoo-${version}.zip`;
const archivePath = path.join(workspace, archiveName);
const checksumPath = `${archivePath}.sha256`;
if (existsSync(archivePath)) unlinkSync(archivePath);
if (existsSync(checksumPath)) unlinkSync(checksumPath);

execFileSync('zip', ['-qr', archivePath, '.'], { cwd: distDirectory });
execFileSync('unzip', ['-tq', archivePath], { stdio: 'pipe' });

const archiveEntries = execFileSync('unzip', ['-Z1', archivePath], { encoding: 'utf8' })
  .split('\n')
  .map((entry) => entry.replace(/^\.\//, '').replace(/\/$/, ''))
  .filter(Boolean);
const archiveFileSet = new Set(archiveEntries);
for (const file of builtFiles) {
  if (!archiveFileSet.has(file)) {
    throw new Error(`The ZIP is missing a built extension file: ${file}`);
  }
}
if (!archiveFileSet.has('manifest.json') || archiveFileSet.has('dist/manifest.json')) {
  throw new Error('The ZIP must contain manifest.json at its root, without a dist/ directory.');
}

const checksum = createHash('sha256').update(readFileSync(archivePath)).digest('hex');
writeFileSync(checksumPath, `${checksum}  ${archiveName}\n`);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `archive_name=${archiveName}\n`);
}

log(`Created and verified ${archiveName} with ${builtFiles.length} packaged files.`);
log(`SHA-256: ${checksum}`);
