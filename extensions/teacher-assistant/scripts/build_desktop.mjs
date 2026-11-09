import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const extension = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repo = resolve(extension, '../..')
const require = createRequire(resolve(repo, 'apps/desktop/package.json'))
const { build } = require('esbuild')

await build({
  entryPoints: [resolve(extension, 'desktop/src/plugin.tsx')],
  outfile: resolve(extension, 'desktop/plugin.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2023',
  jsx: 'automatic',
  external: ['@hermes/plugin-sdk', 'react', 'react/jsx-runtime'],
  minify: false,
  legalComments: 'none',
  banner: { js: '// Generated from desktop/src by scripts/build_desktop.mjs.' },
})
