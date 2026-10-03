import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');

if (fs.existsSync(distDir)) {
  const versionFile = path.join(distDir, 'version.json');
  if (!fs.existsSync(versionFile)) {
    const defaultMeta = {
      version: 1,
      gitSha: 'local',
      builtAt: new Date().toISOString(),
      zipUrl: 'https://wurzelkuchen.github.io/SimpleLists/web-dist.zip'
    };
    fs.writeFileSync(versionFile, JSON.stringify(defaultMeta, null, 2));
    console.log('Generated default version.json in dist/');
  }
}
