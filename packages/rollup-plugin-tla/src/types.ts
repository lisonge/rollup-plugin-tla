import type { AcornNode } from 'rollup';

export type CallExpressionNode = AcornNode & {
  callee: AcornNode & { name?: string };
  arguments: AcornNode[];
};

export type ForOfStatementNode = AcornNode & {
  await: boolean;
};

export type FunctionExpressionNode = AcornNode & {
  id?: null | AcornNode;
  async: boolean;
};

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

export type ResolvedTlaOptions = {
  identifier: string;
  identifierFor: string;
};
