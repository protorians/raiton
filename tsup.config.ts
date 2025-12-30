import {defineConfig} from 'tsup';

export default defineConfig(({watch}) => ({
    entry: ['source/**/*'],
    outDir: 'build',
    format: ['esm'],
    target: 'node22',
    clean: true,
    dts: true,
    banner: {
        // js: '#!/usr/bin/env node',
    },
    splitting: true,
    shims: false,
    sourcemap: false,
    minify: false,
    outExtension: ({format}) => {
        if (format === 'cjs') return {cjs: '.cjs'} as const;
        if (format === 'esm') return {js: '.mjs'} as const;
        return {js: '.js'} as const;
    },
    watch,
}));
