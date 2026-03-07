import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'cli/index': 'src/cli/index.ts',
    'vite-plugin/index': 'src/vite-plugin/index.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node18',
  banner: ({ format }) => {
    // Add shebang only to CLI entry
    return {}
  },
})
