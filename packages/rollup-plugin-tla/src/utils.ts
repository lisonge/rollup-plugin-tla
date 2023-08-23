import type { ResolvedTlaOptions, TlaOptions } from './types';

export const getLnCol = (
  text: string,
  index: number,
): { ln: number; col: number } => {
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

export const startWith = (
  text: string,
  searchString: string,
  position: number,
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

export const resolveTlaOptions = (
  tlaOptions: TlaOptions,
): ResolvedTlaOptions => {
  const identifier = tlaOptions.identifier || `__T$L$A__`;
  return {
    identifier,
    identifierFor: identifier + `FOR`,
  };
};
