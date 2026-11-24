import { describe, expect, test } from 'vite-plus/test';

import { arity, generate, parse } from '../src/lang';

describe('parse', () => {
  test('reads entries, comments, BOM and CRLF', () => {
    const text = '\uFEFF## title\r\na.b=Hello\r\n\r\nc=%s and %s\t## note\r\n';
    const { entries, errors } = parse(text);
    expect(errors).toEqual([]);
    expect(entries.map(({ key, value }) => [key, value])).toEqual([
      ['a.b', 'Hello'],
      ['c', '%s and %s'],
    ]);
    expect(text.slice(entries[1]!.start, entries[1]!.start + 1)).toBe('c');
  });

  test('reports broken lines and duplicates', () => {
    const { errors } = parse('nope\n=x\na=1\na=2');
    expect(errors.map((e) => e.code)).toEqual([1, 1, 2]);
  });
});

describe('arity', () => {
  test('counts positional placeholders and skips %%', () => {
    expect(['%2$s %1$s', '100%%', '%1 %3', '%s and %s'].map(arity)).toEqual([2, 0, 3, 2]);
  });
});

describe('generate', () => {
  test('maps each key back to the .lang text', () => {
    const original = 'x=1\nhello.world=Hi %s';
    const { text, mappings } = generate(parse(original).entries, 'ts');
    for (const [vs, vl, os, ol] of mappings) {
      expect(text.slice(vs, vs + vl)).toBe(original.slice(os, os + ol));
    }
    expect(text).toContain('"hello.world": [string];');
  });

  test('JS output exports each key by name without type syntax', async () => {
    const { text } = generate(parse('a.b=Hi "%s"\nc=x').entries, 'js');
    expect(text).not.toMatch(/LangKey|LangArgs/);
    const lang = await import(`data:text/javascript,${encodeURIComponent(text)}`);
    const { default: all, ...named } = lang;
    expect(named).toEqual({ 'a.b': 'Hi "%s"', c: 'x' });
    expect(all).toEqual(named);
  });

  test('TS output annotates the default export for isolatedDeclarations', () => {
    const { text } = generate(parse('a=Hi').entries, 'ts');
    expect(text).toContain('const _default: {\n  readonly "a": typeof _0;\n} = {');
    expect(text).not.toContain('as const');
  });

  test('declaration output has no initializers', () => {
    const { text } = generate(parse('a=Hi').entries, 'dts');
    expect(text).toContain('declare const _0: "Hi";');
    expect(text).toContain('declare const _default: {\n  readonly "a": typeof _0;\n};');
    expect(text).not.toMatch(/const [^;]*=/);
  });

  test('empty file still gives a valid LangKey', () => {
    expect(generate([], 'ts').text).toContain('export type LangKey = never;');
  });
});
