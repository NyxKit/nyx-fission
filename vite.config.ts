import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import glsl from 'vite-plugin-glsl'

export default defineConfig(({ command, mode }) => {
  if (command === 'serve' || mode === 'demo') {
    return {
      root: 'demo',
      base: './',
      plugins: [vue(), glsl()],
      build: {
        outDir: '../dist-demo',
        emptyOutDir: true,
      },
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
