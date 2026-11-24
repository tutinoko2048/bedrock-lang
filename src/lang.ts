// Offsets are UTF-16 indexes into the original text.

/** One `key=value` line of a .lang file. `start` is where the key begins. */
export interface Entry {
  key: string;
  value: string;
  start: number;
}

/** A line that could not be read. `code` is 1 for a broken line, 2 for a duplicate key. */
export interface ParseError {
  start: number;
  length: number;
  message: string;
  code: number;
}

export const parse = (text: string): { entries: Entry[]; errors: ParseError[] } => {
  const entries: Entry[] = [];
  const errors: ParseError[] = [];
  const seen = new Set<string>();

  let lineStart = text.startsWith('﻿') ? 1 : 0;
  while (lineStart <= text.length) {
    const newline = text.indexOf('\n', lineStart);
    const lineEnd = newline === -1 ? text.length : newline;
    const line = text.slice(lineStart, lineEnd).replace(/\r$/, '');
    const trimmed = line.trim();

    if (trimmed !== '' && !trimmed.startsWith('##')) {
      const eq = line.indexOf('=');
      if (eq <= 0) {
        errors.push({
          start: lineStart,
          length: line.length,
          message: eq === 0 ? 'Empty key.' : "Expected 'key=value'.",
          code: 1,
        });
      } else {
        const key = line.slice(0, eq);
        if (seen.has(key)) {
          errors.push({
            start: lineStart,
            length: key.length,
            message: `Duplicate key '${key}'.`,
            code: 2,
          });
        } else {
          seen.add(key);
          // Bedrock lets a tab followed by ## start a trailing comment
          const value = line
            .slice(eq + 1)
            .split('\t##')[0]!
            .trimEnd();
          entries.push({ key, value, start: lineStart });
        }
      }
    }

    if (newline === -1) break;
    lineStart = newline + 1;
  }

  return { entries, errors };
};

/** Number of `with` arguments a value expects (`%s`, `%1$s`, `%1` ...). */
export const arity = (value: string): number => {
  let sequential = 0;
  let positional = 0;
  for (const m of value.matchAll(/%(?:%|(\d+)\$[sd]|[sd]|(\d+))/g)) {
    if (m[0] === '%%') continue;
    const index = m[1] ?? m[2];
    if (index === undefined) sequential++;
    else positional = Math.max(positional, Number(index));
  }
  return Math.max(sequential, positional);
};

/**
 * [virtualStart, virtualLength, originalStart, originalLength, kind] in UTF-16 units.
 * kind 0 = Verbatim (same text on both sides).
 */
export type Mapping = [number, number, number, number, 0];

/**
 * What `generate` builds:
 * - `ts`: the virtual file TypeScript sees through the content mapper
 * - `js`: the plain JS a bundler loads
 * - `dts`: declarations, for bundlers that bundle .d.ts files (tsdown `dts`)
 */
export type OutputMode = 'ts' | 'js' | 'dts';

/** Builds the module for a .lang file. Every mode exports the same names. */
export const generate = (
  entries: Entry[],
  mode: OutputMode,
): { text: string; mappings: Mapping[] } => {
  let text = '';
  const mappings: Mapping[] = [];
  const emit = (s: string) => (text += s);
  const values = entries.map((entry) => JSON.stringify(entry.value));

  // One export per key, named by the key string (ES2022 arbitrary export names).
  // With `import * as lang`, bundlers drop unused keys and inline used text
  values.forEach((value, i) =>
    emit(mode === 'dts' ? `declare const _${i}: ${value};\n` : `const _${i} = ${value};\n`),
  );
  emit('export {\n');
  entries.forEach((entry, i) => {
    const literal = JSON.stringify(entry.key);
    emit(`  _${i} as `);
    // Map the key text so go-to-definition, hover and references land on the .lang line
    if (mode === 'ts' && literal === `"${entry.key}"`) {
      mappings.push([text.length + 1, entry.key.length, entry.start, entry.key.length, 0]);
    }
    emit(`${literal},\n`);
  });
  emit('};\n');

  // Convenience default export. It keeps every key in the bundle once used, and
  // is dropped entirely when unused, so `import * as` stays the tree-shakable way
  const fields = (line: (key: string, i: number) => string) =>
    entries.forEach((entry, i) => emit(`  ${line(JSON.stringify(entry.key), i)}\n`));
  if (mode === 'js') {
    emit('export default /* @__PURE__ */ Object.freeze({\n');
    fields((key, i) => `${key}: _${i},`);
    emit('});\n');
    return { text, mappings };
  }
  // Annotated so the output passes isolatedDeclarations in the user's project
  emit(mode === 'dts' ? 'declare const _default: {\n' : 'const _default: {\n');
  fields((key, i) => `readonly ${key}: typeof _${i};`);
  if (mode === 'dts') {
    emit('};\n');
  } else {
    emit('} = {\n');
    fields((key, i) => `${key}: _${i},`);
    emit('};\n');
  }
  emit('export default _default;\n');

  const keys = entries.map((entry) => JSON.stringify(entry.key));
  emit(`export type LangKey = ${keys.join(' | ') || 'never'};\n`);
  emit('/** `with` arguments each key expects, counted from its placeholders */\n');
  emit('export interface LangArgs {\n');
  for (const entry of entries) {
    emit(
      `  ${JSON.stringify(entry.key)}: [${Array(arity(entry.value)).fill('string').join(', ')}];\n`,
    );
  }
  emit('}\n');
  return { text, mappings };
};
