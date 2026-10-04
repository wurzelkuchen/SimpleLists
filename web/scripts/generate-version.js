import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');

if (fs.existsSync(distDir)) {
  const versionFile = path.join(distDir, 'version.json');
  if (!fs.existsSync(versionFile)) {
    let version = 1;
    let gitSha = 'local';
    try {
      const gitTimestamp = execSync('git log -1 --format=%ct', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      if (gitTimestamp && !isNaN(Number(gitTimestamp))) {
        version = parseInt(gitTimestamp, 10);
      }
      gitSha = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch (e) {
      // Fallback
    }

    const defaultMeta = {
      version: version,
      gitSha: gitSha,
      builtAt: new Date().toISOString(),
      zipUrl: `https://wurzelkuchen.github.io/SimpleLists/web-dist.zip?v=${version}`
    };
    fs.writeFileSync(versionFile, JSON.stringify(defaultMeta, null, 2));
    console.log(`Generated default version.json in dist/ (v${version})`);
  }
}
