import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['source/index.ts'],
  outDir: 'build',
  format: ['esm'],
  target: 'node22',
  sourcemap: true,
  clean: true,
  dts: false,
  banner: {
    // js: '#!/usr/bin/env node',
  },
});
