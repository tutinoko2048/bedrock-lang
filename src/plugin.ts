import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { createUnplugin, type UnpluginInstance } from 'unplugin';

import { generate, parse } from './lang';

const DECLARATION = /\.d\.[cm]?ts$/;

/**
 * Loads `.lang` files as ES modules for any bundler unplugin supports.
 * Types come from the content mapper, not from this plugin.
 */
export const bedrockLang: UnpluginInstance<undefined, false> = createUnplugin(() => ({
  name: 'bedrock-lang',
  // Declaration bundlers (tsdown `dts`) import .lang from .d.ts files.
  // Point those imports at a declaration version so the types get bundled
  resolveId: {
    filter: { id: /^\.{1,2}\/.*\.lang$/ },
    handler(source, importer) {
      if (!importer || !DECLARATION.test(importer)) return null;
      return `${resolve(dirname(importer), source)}.d.ts`;
    },
  },
  load: {
    filter: { id: /\.lang(?:\.d\.ts)?(?:$|\?)/ },
    async handler(id) {
      const file = id.replace(/[?#].*$/, '');
      const declaration = file.endsWith('.d.ts');
      const path = declaration ? file.slice(0, -'.d.ts'.length) : file;
      const { entries, errors } = parse(await readFile(path, 'utf8'));
      const [first] = errors;
      if (first) throw new Error(`${path}: ${first.message}`);
      return generate(entries, declaration ? 'dts' : 'js').text;
    },
  },
  // .lang is not an extension these bundlers know, so say the output is JS
  esbuild: { loader: 'js' },
  bun: { loader: 'js' },
}));
