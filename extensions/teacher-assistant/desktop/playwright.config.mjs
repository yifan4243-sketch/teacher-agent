export default {
  testDir: './tests',
  testMatch: '*.spec.mjs',
  outputDir: './test-results',
  workers: 1,
  timeout: 180000,
  expect: { timeout: 30000 },
  reporter: [['list']],
}
