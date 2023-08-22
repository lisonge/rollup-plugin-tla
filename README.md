# rollup-plugin-tla

<p>
  <a href="https://www.npmjs.com/package/rollup-plugin-tla"><img src="https://img.shields.io/npm/v/rollup-plugin-tla.svg" alt="npm package"></a>
  <a href="https://github.com/lisonge/rollup-plugin-tla/releases/"><img src="https://img.shields.io/node/v/rollup-plugin-tla.svg" alt="node compatibility"></a>
</p>

A rollup plugin to add top level await support for iife/umd

plugin will use `identifier` to wrap all Top Level `AwaitExpression`/`ForOfStatement` in [transform](https://rollupjs.org/plugin-development/#transform) hook

then unwrap them in [renderChunk](https://rollupjs.org/plugin-development/#renderchunk) hook

then change iife/umd module wrap function to async function

`await xxx` -> `__T$L$A__(xxx)` -> `await xxx`

`for await(const a of b){}` -> `__T$L$A__FOR((async()=>{for await(const a of b){}})())` -> `for await(const a of b){}`

this plugin project code come from [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey/blob/35f56bd76cb426aeab115eda1d8e7c5df1457c5b/packages/vite-plugin-monkey/src/node/topLevelAwait.ts)

## Installation

```shell
pnpm add rollup-plugin-tla
# yarn add rollup-plugin-tla
# npm install rollup-plugin-tla
```

## Usage

```ts
export type TlaOptions = {
  /**
   * plugin will use `identifier` to wrap all Top Level `AwaitExpression`/`ForOfStatement` in [transform](https://rollupjs.org/plugin-development/#transform) hook
   *
   * then unwrap them in [renderChunk](https://rollupjs.org/plugin-development/#renderchunk) hook
   *
   * then change iife/umd module wrap function to async function
   *
   * `await xxx` -> `__T$L$A__(xxx)` -> `await xxx`
   *
   * `for await(const a of b){}` -> `__T$L$A__FOR((async()=>{for await(const a of b){}})())` -> `for await(const a of b){}`
   *
   * ---
   *
   * **BUT** if you already use `__T$L$A__(xxx)` in your code, it will be replaced to `await xxx`
   *
   * So make sure this identifier is `unique` and `unused`
   *
   * @default '__T$L$A__'
   */
  identifier?: string;
};
```

```ts
// rollup.config.ts
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
```

example config code -> [/playground/test-tla/rollup.config.ts](/playground/test-tla/rollup.config.ts)

example dist code -> [playground/test-tla/dist/index.js](playground/test-tla/dist/index.js)
