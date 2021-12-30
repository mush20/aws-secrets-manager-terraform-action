import { snakeCase } from 'snake-case';

/* Validate a possible object i.e., o = { "a": 2 } */
export const isJSONObject = (o: Record<string, any>): boolean =>
  !!o && (typeof o === 'object') && !Array.isArray(o) &&
  ((): boolean => { try { return Boolean(JSON.stringify(o)); } catch { return false; } })();

/* Validate a possible JSON object represented as string i.e., s = '{ "a": 3 }' */
export const isJSONObjectString = (s: string): boolean => {
  try {
    const o = JSON.parse(s);
    return !!o && (typeof o === 'object') && !Array.isArray(o);
  } catch {
    return false;
  }
};

export const getVariableName = (name: string): string => `TF_VAR_${name}`;

export const mapJSONObject = (data: Record<string, any>): Record<string, any> => {
  if (!isJSONObject(data)) {
    throw TypeError('Cannot flatten non JSON arguments');
  }

  return Object.keys(data).reduce((prev, curr) =>
    ({...prev, [getVariableName(curr)]: data[curr]})
  , {});
};

export const filterBy = (items: Array<string>, filter: string): Array<string> => {
  return items.filter(item => new RegExp('^' + filter.replace(/\*/g, '.*') + '$').test(item));
};

export const getPOSIXString = (data: string): string => {
  let snake = snakeCase(data);
  if (snake.match(/^[0-9]/))
    snake = '_'.concat(snake);
  return snake.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();
};
