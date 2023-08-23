import * as acornWalk from 'acorn-walk';
import MagicString from 'magic-string';
import type { AcornNode, Plugin } from 'rollup';
import type {
  CallExpressionNode,
  ForOfStatementNode,
  FunctionExpressionNode,
  TlaOptions,
} from './types';
import { getLnCol, resolveTlaOptions, startWith } from './utils';

const awaitOffset = `await`.length;

const tla = (tlaOptions: TlaOptions = {}): Plugin => {
  const { identifier, identifierFor } = resolveTlaOptions(tlaOptions);
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
          ForOfStatement(node: ForOfStatementNode) {
            if (node.await === true) {
              tlaForOfNodes.push(node);
            }
          },
          // @ts-ignore
          CallExpression(node: CallExpressionNode) {
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
        {
          ...acornWalk.base,
          Function: () => {
            // only visitor top level await
          },
        },
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
        // if node code includes identifier, walk this node
        p[key] = (node, state, callback) => {
          if (code.substring(node.start, node.end).includes(identifier)) {
            return acornWalk.base[key](node, state, callback);
          }
        };
        return p;
      }, {});
      const ast = this.parse(code);

      const tlaCallNodes: CallExpressionNode[] = [];
      const forTlaCallNodes: CallExpressionNode[] = [];
      /**
       * the iife/umd factory function
       */
      const factoryFcNodes: FunctionExpressionNode[] = [];

      acornWalk.simple(
        ast,
        {
          // @ts-ignore
          CallExpression(node: CallExpressionNode) {
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
          Function: (node: FunctionExpressionNode, state, callback) => {
            if (code.substring(node.start, node.end).includes(identifier)) {
              if (factoryFcNodes.length === 0) {
                // the iife/umd factory function
                factoryFcNodes.push(node);
              }
              return acornWalk.base.Function(node, state, callback);
            }
          },
        },
      );
      if (tlaCallNodes.length > 0 || forTlaCallNodes.length > 0) {
        const ms = new MagicString(code);
        tlaCallNodes.forEach((node) => {
          const callee = node.callee;
          // __topLevelAwait__ (xxx) -> await (xxx)
          ms.update(callee.start, callee.end, 'await');
        });
        forTlaCallNodes.forEach((node) => {
          // __topLevelAwait_FOR ((async()=>{ /*start*/for await(const x of xxx){}/*end*/  })()); -> for await(const x of xxx){}
          // @ts-ignore
          const forOfNode = node.arguments?.[0]?.callee?.body
            ?.body?.[0] as ForOfStatementNode;
          if (forOfNode.type === 'ForOfStatement') {
            ms.update(node.start, forOfNode.start, '');
            ms.update(forOfNode.end, node.end, '');
          }
        });
        factoryFcNodes.forEach((node) => {
          if (node.async) return;
          // change factory function to async function
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
export type { TlaOptions } from './types';
