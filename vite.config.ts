/// <reference types="vitest/config" />
import { minify } from 'terser'
import { defineConfig, type Plugin } from 'vite'
import { doctest } from 'vite-plugin-doctest'

// https://github.com/vitejs/vite/issues/6555
const minifyPlugin: Plugin = {
  name: 'minify',
  async generateBundle(_opt, bundle) {
    for (const [fileName, chunk] of Object.entries(bundle)) {
      if (chunk.type !== 'chunk' || !fileName.endsWith('js')) continue
      const res = await minify(chunk.code, {
        ecma: 2020,
        module: true,
        compress: {
          unsafe_arrows: true,
        },
        format: {
          preserve_annotations: true,
        },
      })
      if (res.code == null) throw res
      chunk.code = res.code
    }
  },
  apply: 'build',
}

export default defineConfig(env => ({
  plugins: [doctest({}), minifyPlugin],
  build: {
    target: 'es2020',
    lib: {
      name: 'xunhuan',
      entry: 'src/index.ts',
      fileName: 'index',
    },
    minify: false,
  },
  test: {
    includeSource: ['src/**/*.ts'],
    isolate: false,
    pool: 'threads',
    setupFiles: 'test/setup.ts',
    testTimeout: 50000,
  },
  define: env.mode === 'test' ? {} : { V: 'undefined' },
}))
