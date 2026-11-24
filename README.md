# bedrock-lang

Import Minecraft Bedrock `.lang` files directly from TypeScript.

```ts
import * as lang from './texts/en_US.lang';
import type { LangArgs, LangKey } from './texts/en_US.lang';

lang['craft.msg.saved']; // type: 'Saved recipe "%s"'
```

- **Types** come from a [TypeScript 7.1 content mapper](https://devblogs.microsoft.com/typescript/announcing-typescript-7-1-beta/). There is no codegen step and no generated `.d.ts`.
- **Bundling** works with Vite, Rollup, Rolldown, tsdown, esbuild, webpack, Rspack and Bun through one [unplugin](https://github.com/unjs/unplugin).
- **Tree-shaking** works: with `import * as`, only the keys you use end up in the bundle.

## Requirements

- TypeScript 7.1 or later (currently `typescript@beta`)
- Node.js 20.19+ or 22.12+ on `PATH`, because TypeScript runs the mapper as a `node` process

The package is ESM-only. CommonJS configs such as `webpack.config.js` can still `require('bedrock-lang/webpack')`, because these Node versions support `require()` of ES modules.

## Setup

### Types: content mapper

Add `bedrock-lang` as a dev dependency, then register it in `tsconfig.json`. `contentMappers` goes at the top level, next to `compilerOptions`:

```jsonc
{
  "compilerOptions": {
    // ...
  },
  "contentMappers": [{ "package": "bedrock-lang", "extensions": [".lang"] }],
}
```

Content mappers run external code, so TypeScript only starts them when you pass `--runExternalCode`:

```sh
tsc --runExternalCode
```

Without the flag, `tsc` fails with `TS18068`.

### Editor: VS Code

TypeScript 7 has no `tsserver.js`, so **Select TypeScript Version** does not list it. Install the [TypeScript 7 extension](https://marketplace.visualstudio.com/items?itemName=TypeScriptTeam.native-preview), then add this to `.vscode/settings.json`:

```json
{
  "js/ts.experimental.useTsgo": true,
  "js/ts.tsdk.path": "./node_modules/typescript"
}
```

When VS Code asks, trust the workspace and allow content mappers to run.

### Bundler: plugin

The mapper only provides types. To bundle the actual values, add the plugin:

```ts
// vite.config.ts
import bedrockLang from 'bedrock-lang/vite';

export default defineConfig({
  plugins: [bedrockLang()],
});
```

The plugin is built on [unplugin](https://github.com/unjs/unplugin), so every bundler gets its own entry:

| Bundler          | Import                  | Tree-shaking |
| ---------------- | ----------------------- | ------------ |
| Vite             | `bedrock-lang/vite`     | yes          |
| Rollup           | `bedrock-lang/rollup`   | yes          |
| Rolldown, tsdown | `bedrock-lang/rolldown` | yes          |
| esbuild          | `bedrock-lang/esbuild`  | yes          |
| webpack          | `bedrock-lang/webpack`  | yes          |
| Rspack           | `bedrock-lang/rspack`   | yes          |
| Bun              | `bedrock-lang/bun`      | yes          |
| Rsbuild          | `bedrock-lang/rsbuild`  | untested     |
| Farm             | `bedrock-lang/farm`     | untested     |

"Tree-shaking" means a production build of `lang['…']` with `import * as` kept only the text that was used. For tsdown, pass the plugin to `plugins` (`pack.plugins` in Vite+). The root export `bedrock-lang` is the unplugin instance itself.

You can skip the plugin if you only use `import type`, because type-only imports are erased before bundling.

## Usage

### Namespace import (recommended)

```ts
import * as lang from './texts/en_US.lang';

console.log(lang['example.greeting']);
```

Each key is a separate export with the key itself as the export name, using ES2022 arbitrary module namespace names:

```js
const _0 = 'Hello!';
const _1 = 'Saved recipe "%s"';
export { _0 as 'example.greeting', _1 as 'example.saved' };
```

Static access such as `lang['example.greeting']` lets the bundler drop unused keys and inline the text it keeps. Dynamic access, such as `lang[key]` with a variable `key` or `Object.keys(lang)`, keeps every key.

### Default import

```ts
import lang from './texts/en_US.lang';

Object.keys(lang);
```

Once you use the default export, **every key ends up in the bundle**. If you never use the default export, it is removed entirely, so it costs nothing to namespace-import users.

### Types

| Export     | Description                                                 |
| ---------- | ----------------------------------------------------------- |
| `LangKey`  | Union of all keys in the file                               |
| `LangArgs` | Maps each key to a tuple of the `with` arguments it expects |

The package intentionally ships no translation helper. You choose the name and the shape. For example, a `RawMessage` builder for `@minecraft/server`:

```ts
import type { RawMessage } from '@minecraft/server';
import type { LangArgs, LangKey } from './texts/en_US.lang';

export const translate = <K extends LangKey>(key: K, ...args: LangArgs[K]): RawMessage => ({
  translate: key,
  with: args,
});

translate('example.saved', 'Iron Sword'); // ok
translate('example.saved'); // error: expected 1 argument
translate('example.typo'); // error: unknown key
```

Translation still happens on the game client. Importing the values only matters when you need the source text in your scripts, and it bundles that one language's text.

## `.lang` format

| Input                               | Handling                                              |
| ----------------------------------- | ----------------------------------------------------- |
| `key=value`                         | One entry. The key is everything before the first `=` |
| `## comment`                        | Ignored                                               |
| `value<TAB>## comment`              | The trailing comment is stripped                      |
| Blank lines, BOM, CRLF              | Accepted                                              |
| A line without `=`, or an empty key | Reported as an error on that line                     |
| Duplicate key                       | Reported as an error on the second occurrence         |

Errors are reported in the `.lang` file itself, with the source `bedrock-lang`.

### Placeholder counting for `LangArgs`

| Placeholder    | Effect on the argument count |
| -------------- | ---------------------------- |
| `%s`, `%d`     | Each one adds one argument   |
| `%1$s`, `%2$d` | Count is the highest index   |
| `%1`, `%2`     | Count is the highest index   |
| `%%`           | Escape, not counted          |

When a value mixes sequential and positional placeholders, the larger count wins.

## Language features

The mapper maps each key back to its line in the `.lang` file, so go to definition, hover and find references from `lang['…']` land in the `.lang` file. Hovering a key shows its text as a literal type.

## Limitations

- Type checkers that are not mapper-aware do not see the types: TypeScript 7.0 and earlier, and the type-aware lint in `vp check` / oxlint. For those, run `tsc --runExternalCode` separately.
- While a `.lang` file has errors, `tsc` reports only those and skips semantic errors in TypeScript files.
- Keys that need escaping in a JS string literal still work, but they are not mapped back to the `.lang` file for editor features.
- Keys are not compared between language files. Check that `en_US.lang` and the other languages define the same keys in your own tooling.

## Development

```sh
vp install
vp pack   # build dist/ (the mapper runs from dist/mapper.mjs)
vp test

cd example
pnpm exec tsc --runExternalCode
vp pack && node scripts/main.js
```
