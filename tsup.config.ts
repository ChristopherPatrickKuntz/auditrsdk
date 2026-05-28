import { defineConfig } from 'tsup';
import { readFileSync } from 'node:fs';

// Read the published version once at build time so the SDK_VERSION
// constant in src/http.ts stays in lockstep with package.json.
const { version } = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string };

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
});
