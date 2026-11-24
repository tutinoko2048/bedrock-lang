import bedrockLang from 'bedrock-lang/rolldown';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: 'src/main.ts',
    outDir: 'scripts',
    platform: 'neutral',
    plugins: [bedrockLang()],
    dts: true,
  },
});
