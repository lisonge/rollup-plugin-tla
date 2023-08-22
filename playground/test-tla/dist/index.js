var __Expose = (async function () {
  'use strict';

  await( fetch(`/`));

  var r = await( fetch(`/node_modules`));

  console.log(r, await( fetch(`/package.json`)));

  for await (const x of [Promise.resolve(1), Promise.resolve(2)]) {
    for await (const y of [Promise.resolve(3), Promise.resolve(4)]) {
      console.log({ x, y });
    };
  };

  var index = [await( fetch(`/`)), 1];

  return index;

})();
//# sourceMappingURL=index.js.map
