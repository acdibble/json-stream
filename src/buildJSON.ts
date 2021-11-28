/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { on } from 'events';
import { Readable } from 'stream';
import JSONParseStream, { Token, TokenType } from './JSONParseStream';

type TokenIterator = AsyncIterableIterator<[Token]>;

const NONE = Symbol('none');

const isPrimitive = (token: Token): boolean =>
  [
    TokenType.Null,
    TokenType.True,
    TokenType.False,
    TokenType.String,
    TokenType.Number,
  ].includes(token.type);

const collectObject = async (
  iterator: TokenIterator,
): Promise<Record<string, unknown>> => {
  const object: Record<string, unknown> = {};

  let key = await buildFromIterator(iterator);
  while (true) {
    if (key === NONE) return object;
    if (typeof key !== 'string') throw new Error('key must be string');
    const value = await buildFromIterator(iterator);
    if (value === NONE) throw new Error('missing value for key');
    object[key] = value;
    key = await buildFromIterator(iterator);
  }
};

const collectArray = async (iterator: TokenIterator): Promise<any[]> => {
  const array = [];

  while (true) {
    const next = await buildFromIterator(iterator);
    if (next === NONE) return array;
    array.push(next);
  }
};

const buildFromIterator = async (iterator: TokenIterator): Promise<any> => {
  const current = await iterator.next();
  if (current.done) throw new Error();
  const [token] = current.value;

  if (isPrimitive(token)) return token.value;

  if (token.type === TokenType.ArrayStart) return collectArray(iterator);

  if (token.type === TokenType.ObjectStart) return collectObject(iterator);

  if (token.type === TokenType.ArrayEnd || token.type === TokenType.ObjectEnd) {
    return NONE;
  }

  throw new Error('unreachable');
};

const buildJSON = (stream: Readable): Promise<any> => {
  const parseStream = new JSONParseStream();
  const iterator = on(parseStream, 'token') as TokenIterator;
  stream.pipe(parseStream);
  return buildFromIterator(iterator);
};

export default buildJSON;
