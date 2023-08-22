import r from './b';

console.log(r, await fetch(`/package.json`));

for await (const x of [Promise.resolve(1), Promise.resolve(2)]) {
  for await (const y of [Promise.resolve(3), Promise.resolve(4)]) {
    console.log({ x, y });
  }
}

export default [await fetch(`/`), 1];
