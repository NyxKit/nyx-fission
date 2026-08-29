import { defineConfig } from 'vite'
import glsl from 'vite-plugin-glsl'

export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {
      root: 'demo',
      plugins: [glsl()],
    }
  }

  return {
    plugins: [glsl()],
    build: {
      lib: {
        entry: 'src/index.ts',
        formats: ['es'],
        fileName: () => 'nyx-fission.js',
      },
      rollupOptions: {
        external: ['three'],
      },
    },
  }
})
