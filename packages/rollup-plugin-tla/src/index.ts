import * as acornWalk from 'acorn-walk';
import MagicString from 'magic-string';
import type { AcornNode, Plugin } from 'rollup';

const getLnCol = (text: string, index: number): { ln: number; col: number } => {
  if (index < 0 || index > text.length) {
    throw new Error('Index out of range');
  }

  let ln = 1;
  let col = 1;

  for (let i = 0; i < index; i++) {
    if (text[i] === '\n') {
      ln++;
      col = 1;
    } else {
      col++;
    }
  }

  return { ln, col };
};

type CallAcornNode = AcornNode & {
  callee: AcornNode & { name: string };
  arguments: AcornNode[];
};
const awaitOffset = `await`.length;
const startWith = (
  text: string,
  searchString: string,
  position = 0,
  ignoreString: string,
) => {
  for (let i = position; i < text.length; i++) {
    if (ignoreString.includes(text[i])) {
      continue;
    }
    return text.startsWith(searchString, i);
  }
  return false;
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
const tla = (tlaOptions: TlaOptions = {}): Plugin => {
  const identifier = tlaOptions.identifier || `__T$L$A__`;
  const identifierFor = identifier + `FOR`;
  return {
    name: `tla`,
    transform(code, id) {
      if (!code.includes(`await`)) return;
      const ast = this.parse(code);
      const tlaNodes: AcornNode[] = [];
      const tlaForOfNodes: AcornNode[] = [];
      acornWalk.simple(
        ast,
        {
          AwaitExpression(node) {
            // top level await
            tlaNodes.push(node);
          },
          // @ts-ignore
          ForOfStatement(node: AcornNode & { await: boolean }) {
            if (node.await === true) {
              tlaForOfNodes.push(node);
            }
          }, // @ts-ignore
          CallExpression(node: CallAcornNode) {
            const { name, type } = node.callee ?? {};
            if (
              type === `Identifier` &&
              (name === identifier || name === identifierFor)
            ) {
              console.error(`[rollup-plugin-tla] error source id: ${id}`);
              const { col, ln } = getLnCol(code, node.start);
              console.error(
                `[rollup-plugin-tla] error source position Ln:${ln}, Col:${col}`,
              );
              throw new Error(
                `[rollup-plugin-tla] source code cannot contain CallExpression that whose identifier is ${name}, just change tlaOptions.identifier to use a unique and unused identifier`,
              );
            }
          },
        },
        { ...acornWalk.base, Function: () => {} },
      );
      if (tlaNodes.length > 0 || tlaForOfNodes.length > 0) {
        const ms = new MagicString(code);
        tlaNodes.forEach((node) => {
          if (!startWith(code, '(', node.start + awaitOffset, '\x20\t\r\n')) {
            // await xxx -> await (xxx)
            ms.appendLeft(node.start + awaitOffset, `(`);
            ms.appendRight(node.end, `)`);
          }

          // await (xxx) -> __topLevelAwait__ (xxx)
          ms.update(node.start, node.start + awaitOffset, identifier);
        });
        tlaForOfNodes.forEach((node) => {
          // for await(const x of xxx){} -> __topLevelAwait_FOR ((async()=>{ /*start*/for await(const x of xxx){}/*end*/  })());
          ms.appendLeft(node.start, `${identifierFor}((async()=>{`);
          ms.appendRight(node.end, `})());`);
        });
        return {
          code: ms.toString(),
          map: ms.generateMap(),
        };
      }
    },
    renderChunk(code) {
      if (!code.includes(identifier)) return;
      const base = Object.keys(acornWalk.base).reduce<
        Record<string, acornWalk.RecursiveWalkerFn<any>>
      >((p, key) => {
        if (key in p) return p;
        p[key] = (node, state, callback) => {
          if (code.substring(node.start, node.end).includes(identifier)) {
            return acornWalk.base[key](node, state, callback);
          }
        };
        return p;
      }, {});
      const ast = this.parse(code);
      const tlaCallNodes: CallAcornNode[] = [];
      const forTlaCallNodes: CallAcornNode[] = [];
      const topFnNodes: AcornNode[] = [];
      acornWalk.simple(
        ast,
        {
          // @ts-ignore
          CallExpression(node: CallAcornNode) {
            const { name, type } = node.callee ?? {};
            if (type === `Identifier`) {
              if (name === identifier) {
                // top level await
                tlaCallNodes.push(node);
              } else if (name === identifierFor) {
                // top level for await
                forTlaCallNodes.push(node);
              }
            }
          },
        },
        {
          ...base,
          Function: (node, state, callback) => {
            if (topFnNodes.length == 0) {
              topFnNodes.push(node);
            }
            if (code.substring(node.start, node.end).includes(identifier)) {
              return acornWalk.base.Function(node, state, callback);
            }
          },
        },
      );
      if (tlaCallNodes.length > 0 || forTlaCallNodes.length > 0) {
        const ms = new MagicString(code, {});
        tlaCallNodes.forEach((node) => {
          const callee = node.callee;
          // __topLevelAwait__ (xxx) -> await (xxx)
          ms.update(callee.start, callee.end, 'await');
        });
        forTlaCallNodes.forEach((node) => {
          // __topLevelAwait_FOR ((async()=>{ /*start*/for await(const x of xxx){}/*end*/  })()); -> for await(const x of xxx){}
          // @ts-ignore
          const forOfNode = node.arguments?.[0]?.callee?.body
            ?.body?.[0] as AcornNode;
          if (forOfNode.type == 'ForOfStatement') {
            ms.update(node.start, forOfNode.start, '');
            ms.update(forOfNode.end, node.end, '');
          }
        });
        topFnNodes.forEach((node) => {
          ms.appendLeft(node.start, `async\x20`);
        });
        return {
          code: ms.toString(),
          map: ms.generateMap(),
        };
      }
    },
  };
};

export default tla;
