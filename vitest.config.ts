import vue from '@vitejs/plugin-vue'
import type { InlineConfig } from 'vitest/node'

export default {
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts', 'demo/**/*.spec.ts'],
  } satisfies InlineConfig,
}
