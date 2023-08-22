import { defineConfig } from 'tsup';

const outExtension = (ctx: { format: 'esm' | 'cjs' | 'iife' }) => ({
  js: { esm: '.mjs', cjs: '.cjs', iife: '.js' }[ctx.format],
});

export default defineConfig([
  {
    entry: ['src/index.ts'],
    sourcemap: true,
    clean: true,
    dts: true,
    outDir: 'dist',
    format: ['cjs', 'esm'],
    target: 'node14',
    shims: true,
    outExtension,
  },
]);
