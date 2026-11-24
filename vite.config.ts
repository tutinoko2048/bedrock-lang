import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: [
      'src/index.ts',
      'src/mapper.ts',
      ...[
        'vite',
        'rollup',
        'rolldown',
        'esbuild',
        'webpack',
        'rspack',
        'rsbuild',
        'farm',
        'bun',
      ].map((bundler) => `src/${bundler}.ts`),
    ],
    platform: 'node',
    // TypeScript 7 has no JS compiler API for tsc-based d.ts.
    // tsconfig's isolatedDeclarations makes this use oxc instead
    dts: true,
    // Writes package.json "exports" from the entries. The mapper is run by
    // TypeScript through "typescript.contentMapper.exec", not imported
    exports: { exclude: ['mapper'] },
  },
  fmt: {
    singleQuote: true,
    ignorePatterns: ['pnpm-lock.yaml', 'dist/**', 'example/scripts/**'],
  },
  lint: {
    ignorePatterns: ['dist/**', 'example/**'],
  },
  test: {
    include: ['test/**/*.test.ts'],
  },
});
