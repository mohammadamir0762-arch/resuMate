import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), offlineServiceWorker()],
  worker: {
    format: 'es',
  },
});

// After a build, writes dist/sw.js with the list of every built file,
// so the service worker can cache the whole app on the first visit.
function offlineServiceWorker() {
  let outDir;

  return {
    name: 'resumate-offline-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const files = listFiles(outDir).filter((file) => file !== 'sw.js' && !file.endsWith('.map'));
      const hash = createHash('sha256');
      for (const file of files) hash.update(file).update(readFileSync(path.join(outDir, file)));

      const precache = {
        version: hash.digest('hex').slice(0, 12),
        urls: ['./', ...files.map((file) => `./${file}`)],
      };
      const source = readFileSync(path.resolve('src/sw.js'), 'utf8');
      writeFileSync(
        path.join(outDir, 'sw.js'),
        `self.__RESUMATE_PRECACHE__ = ${JSON.stringify(precache)};\n\n${source}`,
      );
    },
  };
}

function listFiles(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory()
      ? listFiles(path.join(directory, entry.name), relative)
      : [relative];
  });
}
