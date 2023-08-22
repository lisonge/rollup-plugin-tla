import typescript from '@rollup/plugin-typescript';
import { defineConfig } from 'rollup';
import tla from 'rollup-plugin-tla';

export default defineConfig({
  input: './src/index.ts',
  output: {
    format: 'iife',
    dir: './dist',
    name: `__Expose`,
    sourcemap: true,
  },
  plugins: [typescript(), tla()],
});
