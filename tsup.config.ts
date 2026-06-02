import { defineConfig } from 'tsup';
import { readFileSync, writeFileSync } from 'node:fs';

// Read the published version once at build time so the SDK_VERSION
// constant in src/http.ts stays in lockstep with package.json.
const { version } = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string };

// tsup/esbuild can emit two identical `//# sourceMappingURL=` footers
// for these multi-entry ESM bundles. Collapse to a single footer
// (keep the last) so the published dist is clean.
function dedupeSourcemapFooters(): void {
  for (const file of ['dist/index.js', 'dist/schema/index.js']) {
    let src: string;
    try {
      src = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const lines = src.split('\n');
    const isMap = (l: string) => l.startsWith('//# sourceMappingURL=');
    const cleaned = lines.filter((l, i) => !(isMap(l) && lines.slice(i + 1).some(isMap)));
    const out = cleaned.join('\n');
    if (out !== src) writeFileSync(file, out);
  }
}

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'schema/index': 'src/schema/index.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  minify: false,
  target: 'es2022',
  define: {
    __SDK_VERSION__: JSON.stringify(version),
  },
  async onSuccess() {
    dedupeSourcemapFooters();
  },
});
