/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { on } from 'events';
import { Readable } from 'stream';
import JSONParseStream, { Token, TokenType } from './JSONParseStream';

const isPrimitive = (token: Token): boolean =>
  [
    TokenType.Null,
    TokenType.True,
    TokenType.False,
    TokenType.String,
    TokenType.Number,
  ].includes(token.type);

const buildJSON = async (stream: Readable): Promise<any> => {
  const parseStream = new JSONParseStream();
  stream.pipe(parseStream);
  const iterator = on(parseStream, 'token') as AsyncIterableIterator<[Token]>;

  let result: any;
  let current = await iterator.next();
  while (!current.done) {
    const [token] = current.value;
    if (isPrimitive(token)) {
      return token.value;
    }

    current = await iterator.next();
  }

  return result;
};

export default buildJSON;
