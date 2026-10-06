import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');
const publicDir = path.resolve(__dirname, '../public');
const appAssetsDir = path.resolve(__dirname, '../../app/src/main/assets/web');

let version = Math.floor(Date.now() / 1000);
let buildNumber = 18;
let gitSha = 'local';
const builtAt = new Date().toISOString();

try {
  const gitTimestamp = execSync('git log -1 --format=%ct', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  if (gitTimestamp && !isNaN(Number(gitTimestamp))) {
    version = parseInt(gitTimestamp, 10);
  }
  const count = execSync('git rev-list --count HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  if (count && !isNaN(Number(count))) {
    buildNumber = parseInt(count, 10);
  }
  gitSha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
} catch (e) {
  // Fallback
}

const meta = {
  version: version,
  buildNumber: buildNumber,
  versionName: `1.0.${buildNumber}`,
  gitSha: gitSha,
  builtAt: builtAt,
  zipUrl: `https://wurzelkuchen.github.io/SimpleLists/web-dist.zip?v=${version}`
};

const jsonStr = JSON.stringify(meta, null, 2);

if (fs.existsSync(distDir)) {
  fs.writeFileSync(path.join(distDir, 'version.json'), jsonStr);
  console.log(`Generated version.json in dist/ (v${meta.versionName} / build #${buildNumber})`);
}

if (fs.existsSync(publicDir)) {
  fs.writeFileSync(path.join(publicDir, 'version.json'), jsonStr);
  console.log(`Updated public/version.json (v${meta.versionName} / build #${buildNumber})`);
}

if (fs.existsSync(appAssetsDir)) {
  fs.writeFileSync(path.join(appAssetsDir, 'version.json'), jsonStr);
  console.log(`Updated app/src/main/assets/web/version.json (v${meta.versionName} / build #${buildNumber})`);
}
