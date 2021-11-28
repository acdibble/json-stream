/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { on, once } from 'events';
import { Readable } from 'stream';
import JSONParseStream, { TokenType } from '../JSONParseStream';

describe(JSONParseStream, () => {
  it('emits null', async () => {
    const jsonStream = Readable.from('null').pipe(new JSONParseStream());
    const [token] = await once(jsonStream, 'token');
    expect(token).toMatchObject({ type: TokenType.Null, value: null });
  });

  it('emits null', async () => {
    const jsonStream = Readable.from('   null    ').pipe(new JSONParseStream());
    const [token] = await once(jsonStream, 'token');
    expect(token).toMatchObject({ type: TokenType.Null, value: null });
  });

  it('emits true', async () => {
    const jsonStream = Readable.from('true').pipe(new JSONParseStream());
    const [token] = await once(jsonStream, 'token');
    expect(token).toMatchObject({ type: TokenType.True, value: true });
  });

  it('emits false', async () => {
    const jsonStream = Readable.from('false').pipe(new JSONParseStream());
    const [token] = await once(jsonStream, 'token');
    expect(token).toMatchObject({ type: TokenType.False, value: false });
  });

  it('emits 1234567890', async () => {
    const jsonStream = Readable.from('1234567890').pipe(new JSONParseStream());
    const [token] = await once(jsonStream, 'token');
    expect(token).toMatchObject({ type: TokenType.Number, value: 1234567890 });
  });

  it('emits -123.1', async () => {
    const jsonStream = Readable.from('-123.1').pipe(new JSONParseStream());
    const [token] = await once(jsonStream, 'token');
    expect(token).toMatchObject({ type: TokenType.Number, value: -123.1 });
  });

  it('emits 0', async () => {
    const jsonStream = Readable.from('0').pipe(new JSONParseStream());
    const [token] = await once(jsonStream, 'token');
    expect(token).toMatchObject({ type: TokenType.Number, value: 0 });
  });

  it('emits 10e2', async () => {
    const jsonStream = Readable.from('10e2').pipe(new JSONParseStream());
    const [token] = await once(jsonStream, 'token');
    expect(token).toMatchObject({ type: TokenType.Number, value: 10e2 });
  });

  it('emits 100e-2', async () => {
    const jsonStream = Readable.from('100e-2').pipe(new JSONParseStream());
    const [token] = await once(jsonStream, 'token');
    expect(token).toMatchObject({ type: TokenType.Number, value: 100e-2 });
  });

  it('emits 10e+2', async () => {
    const jsonStream = Readable.from('10e+2').pipe(new JSONParseStream());
    const [token] = await once(jsonStream, 'token');
    expect(token).toMatchObject({ type: TokenType.Number, value: 10e2 });
  });

  it('emits -0', async () => {
    const jsonStream = Readable.from('-0').pipe(new JSONParseStream());
    const [token] = await once(jsonStream, 'token');
    expect(token).toMatchObject({ type: TokenType.Number, value: -0 });
  });

  it('emits "hello world"', async () => {
    const jsonStream = Readable.from('"hello world"').pipe(
      new JSONParseStream(),
    );
    const [token] = await once(jsonStream, 'token');
    expect(token).toMatchObject({
      type: TokenType.String,
      value: 'hello world',
    });
  });

  it('emits "hello\\nworld"', async () => {
    const jsonStream = Readable.from('"hello\\nworld"').pipe(
      new JSONParseStream(),
    );
    const [token] = await once(jsonStream, 'token');
    expect(token).toMatchObject({
      type: TokenType.String,
      value: 'hello\nworld',
    });
  });

  it('emits "hello world" when broken in half', async () => {
    const jsonStream = new JSONParseStream();
    const promise = once(jsonStream, 'token');
    jsonStream.write('"hello ');
    jsonStream.write('world"');
    jsonStream.end();
    expect((await promise)[0]).toMatchObject({
      type: TokenType.String,
      value: 'hello world',
    });
  });

  it('emits "null"', async () => {
    const jsonStream = Readable.from('   "null"    ').pipe(
      new JSONParseStream(),
    );
    const [token] = await once(jsonStream, 'token');
    expect(token).toMatchObject({ type: TokenType.String, value: 'null' });
  });

  it('emits array start and stop', async () => {
    const jsonStream = Readable.from('[]').pipe(new JSONParseStream());
    const it = on(jsonStream, 'token');
    expect((await it.next()).value[0]).toMatchObject({
      type: TokenType.ArrayStart,
      value: '[',
    });
    expect((await it.next()).value[0]).toMatchObject({
      type: TokenType.ArrayEnd,
      value: ']',
    });
  });

  it('handles empty string in an array', async () => {
    const jsonStream = Readable.from('[""]').pipe(new JSONParseStream());
    const it = on(jsonStream, 'token');
    expect((await it.next()).value[0]).toMatchObject({
      type: TokenType.ArrayStart,
      value: '[',
    });
    expect((await it.next()).value[0]).toMatchObject({
      type: TokenType.String,
      value: '',
    });
    expect((await it.next()).value[0]).toMatchObject({
      type: TokenType.ArrayEnd,
      value: ']',
    });
  });

  it('emits correct tokens for array', async () => {
    const jsonStream = Readable.from('[1, true, "test"]').pipe(
      new JSONParseStream(),
    );
    const it = on(jsonStream, 'token');
    expect((await it.next()).value[0]).toMatchObject({
      type: TokenType.ArrayStart,
      value: '[',
    });
    expect((await it.next()).value[0]).toMatchObject({
      type: TokenType.Number,
      value: 1,
    });
    expect((await it.next()).value[0]).toMatchObject({
      type: TokenType.True,
      value: true,
    });
    expect((await it.next()).value[0]).toMatchObject({
      type: TokenType.String,
      value: 'test',
    });
    expect((await it.next()).value[0]).toMatchObject({
      type: TokenType.ArrayEnd,
      value: ']',
    });
  });

  it('emits correct tokens for chunked array', async () => {
    const jsonStream = new JSONParseStream();
    const it = on(jsonStream, 'token');

    jsonStream.write('[12');
    jsonStream.write('3, ');
    jsonStream.write('tru');
    jsonStream.write('e, "tes');
    jsonStream.write('t"]');
    jsonStream.end();

    expect((await it.next()).value[0]).toMatchObject({
      type: TokenType.ArrayStart,
      value: '[',
    });
    expect((await it.next()).value[0]).toMatchObject({
      type: TokenType.Number,
      value: 123,
    });
    expect((await it.next()).value[0]).toMatchObject({
      type: TokenType.True,
      value: true,
    });
    expect((await it.next()).value[0]).toMatchObject({
      type: TokenType.String,
      value: 'test',
    });
    expect((await it.next()).value[0]).toMatchObject({
      type: TokenType.ArrayEnd,
      value: ']',
    });
  });

  it('emits object start and stop', async () => {
    const jsonStream = Readable.from('{}').pipe(new JSONParseStream());
    const it = on(jsonStream, 'token');
    expect((await it.next()).value[0]).toMatchObject({
      type: TokenType.ObjectStart,
      value: '{',
    });
    expect((await it.next()).value[0]).toMatchObject({
      type: TokenType.ObjectEnd,
      value: '}',
    });
  });

  it('object with values', async () => {
    const jsonStream = Readable.from('{"hello":"world"}').pipe(
      new JSONParseStream(),
    );
    const it = on(jsonStream, 'token');
    expect((await it.next()).value[0]).toMatchObject({
      type: TokenType.ObjectStart,
      value: '{',
    });
    expect((await it.next()).value[0]).toMatchObject({
      type: TokenType.String,
      value: 'hello',
    });
    expect((await it.next()).value[0]).toMatchObject({
      type: TokenType.String,
      value: 'world',
    });
    expect((await it.next()).value[0]).toMatchObject({
      type: TokenType.ObjectEnd,
      value: '}',
    });
  });
});
