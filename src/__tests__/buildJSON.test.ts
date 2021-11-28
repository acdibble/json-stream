import { Readable } from 'stream';
import buildJSON from '../buildJSON';

describe(buildJSON, () => {
  it.each([
    ['null'],
    ['true'],
    ['false'],
    ['1234567890'],
    ['-123.11'],
    ['0'],
    ['10e2'],
    ['100e-2'],
    ['10e+2'],
    ['-0'],
    ['"hello world"'],
    ['"hello\\nworld"'],
    ['"null"'],
    ['[]'],
    ['[1]'],
    ['{}'],
    ['{"hello":"world"}'],
    [
      JSON.stringify({
        array: [1, 2, true, false, null, 'string'],
        obj: {
          true: true,
          undefined,
          false: false,
          array: [{ hello: 'world' }],
        },
      }),
    ],
  ])('emits %s', async (string) => {
    expect(await buildJSON(Readable.from(string))).toStrictEqual(
      JSON.parse(string),
    );
  });
});
