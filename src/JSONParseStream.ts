/* eslint-disable no-labels */
import { Writable, WritableOptions } from 'stream';

export enum TokenType {
  Null,
  True,
  False,
  Number,
  String,
  ArrayStart,
  ArrayEnd,
  ObjectStart,
  ObjectEnd,
  Error,
  EOF,
}

interface TokenValue {
  [TokenType.Null]: null;
  [TokenType.True]: true;
  [TokenType.False]: false;
  [TokenType.Number]: number;
  [TokenType.String]: string;
  [TokenType.ArrayStart]: '[';
  [TokenType.ArrayEnd]: ']';
  [TokenType.ObjectStart]: '{';
  [TokenType.ObjectEnd]: '}';
  [TokenType.Error]: Error;
  [TokenType.EOF]: 'EOF';
}

export interface Token<T extends TokenType = TokenType> {
  type: T;
  value: TokenValue[T];
}

export default class JSONParseStream extends Writable {
  private buffer: string[] = [];

  private currentIndex = 0;

  private tokenStart = 0;

  private finished = false;

  private hadError = false;

  private sliceAt = 0;

  private brackets: ('[' | '{')[] = [];

  constructor(opts?: WritableOptions) {
    super(opts);

    this.on('finish', () => {
      this.finished = true;
      if (!this.hadError) {
        this.emitTokens();
        this.emitToken(TokenType.EOF, 'EOF');
      }
    });
  }

  // eslint-disable-next-line no-underscore-dangle
  override _write(chunk: Buffer, encoding: unknown, callback: () => void) {
    this.buffer.push(...chunk.toString('utf8'));

    this.emitTokens();

    callback();
  }

  private emitTokens() {
    if (this.hadError) return;
    this.currentIndex = 0;

    while (this.parseValue()) {
      // pass
    }

    if (this.sliceAt > 0) this.buffer = this.buffer.slice(this.sliceAt);
    this.sliceAt = 0;
  }

  private previous(): string | null {
    return this.buffer[this.currentIndex - 1] ?? null;
  }

  private emitError(): boolean {
    this.hadError = true;
    this.emitToken(
      TokenType.Error,
      new Error(`unexpected token '${this.previous()}''`),
    );
    this.emit('finish');
    return false;
  }

  private matches(...values: string[]): boolean {
    return values.some((v) => this.currentChar() === v);
  }

  private consumeWhitespace() {
    while (this.matches(' ', '\n', '\r', '\t')) {
      this.currentIndex += 1;
      this.sliceAt += 1;
    }
  }

  private parseValue(): boolean {
    this.tokenStart = this.currentIndex;
    this.consumeWhitespace();

    if (this.isAtEnd()) {
      return false;
    }

    switch (this.advance()) {
      case 'n':
        return this.parseLiteral('ull', TokenType.Null);
      case 't':
        return this.parseLiteral('rue', TokenType.True);
      case 'f':
        return this.parseLiteral('alse', TokenType.False);
      case '-':
      case '0':
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        return this.parseNumber();
      case '"':
        return this.parseString();
      case '[':
        this.brackets.push('[');
        return this.emitToken(TokenType.ArrayStart, '[');
      case ']':
        if (this.brackets.pop() === '[') {
          return this.emitToken(TokenType.ArrayEnd, ']');
        }
        return this.emitError();
      case '{':
        this.brackets.push('{');
        return this.emitToken(TokenType.ObjectStart, '{');
      case '}':
        if (this.brackets.pop() === '{') {
          return this.emitToken(TokenType.ObjectEnd, '}');
        }
        return this.emitError();
      case ':':
        if (this.brackets[this.brackets.length - 1] === '{') return true;
        return this.emitError();
      case ',':
        if (['[', '{'].includes(this.brackets[this.brackets.length - 1]!)) {
          return true;
        }
        return this.emitError();
      default:
        return this.emitError();
    }
  }

  private getLexeme(): string {
    const lexeme = this.buffer
      .slice(this.tokenStart, this.currentIndex)
      .join('');
    return lexeme;
  }

  private emitToken<T extends TokenType>(
    type: T,
    value?: TokenValue[T],
  ): boolean {
    try {
      const parsedValue =
        value ?? (JSON.parse(this.getLexeme()) as TokenValue[T]);
      this.emit('token', { type, value: parsedValue } as Token<T>);
      this.sliceAt = this.currentIndex;
      return true;
    } catch {
      return this.emitError();
    }
  }

  private isAtEnd(): boolean {
    return this.currentIndex >= this.buffer.length;
  }

  private currentChar(): string | null {
    return this.buffer[this.currentIndex] ?? null;
  }

  private consume(char: string): boolean {
    if (this.currentChar() === char) {
      this.currentIndex += 1;
      return true;
    }

    return false;
  }

  private advance(): string | null {
    return this.buffer[this.currentIndex++] ?? null;
  }

  private peek(): string | null {
    return this.buffer[this.currentIndex] ?? null;
  }

  private parseLiteral(literal: string, type: TokenType): boolean {
    for (const char of literal) {
      if (this.isAtEnd()) return false;
      if (!this.consume(char)) {
        return this.emitError();
      }
    }

    return this.emitToken(type);
  }

  private parseNumber(): boolean {
    let expectDecimal = true;
    let expectExponent = true;
    let expectSign = false;
    let complete = this.finished;

    loop: while (!this.isAtEnd()) {
      switch (this.peek()) {
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          this.advance();
          continue;
        case '.':
          if (expectDecimal) {
            expectDecimal = false;
            this.advance();
            continue;
          }
          complete = true;
          break loop;
        case 'E':
        case 'e':
          if (expectExponent) {
            expectExponent = false;
            expectSign = true;
            this.advance();
            continue;
          }
          complete = true;
          break loop;
        case '+':
        case '-':
          if (expectSign) {
            expectSign = false;
            this.advance();
            continue;
          }
          complete = true;
          break loop;
        default:
          complete = true;
          break loop;
      }
    }

    return complete && this.emitToken(TokenType.Number);
  }

  private parseString(): boolean {
    let complete = this.finished;
    loop: while (!this.isAtEnd()) {
      switch (this.advance()) {
        case '\\':
          this.advance();
          continue;
        case '"':
          complete = true;
          break loop;
        case null:
          break loop;
        default:
          continue;
      }
    }

    return complete && this.emitToken(TokenType.String);
  }
}
