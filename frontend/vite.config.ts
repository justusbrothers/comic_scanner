// frontend/vite.config.ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteExternalsPlugin } from 'vite-plugin-externals';

// Map external dependencies provided globally by InvenTree at runtime
export const externalLibs = {
  react: 'React',
  'react-dom': 'ReactDOM',
  'react-dom/client': 'ReactDOM',
  'react/jsx-runtime': 'React',
  '@lingui/core': 'LinguiCore',
  '@lingui/react': 'LinguiReact',
  '@mantine/core': 'MantineCore',
  '@mantine/hooks': 'MantineHooks',
  '@mantine/notifications': 'MantineNotifications',
  '@inventreedb/ui': 'InvenTreeUI',
};

export default defineConfig({
  plugins: [
    react(),
    // viteExternalsPlugin handles replacing imports with global window objects
    viteExternalsPlugin(externalLibs),
  ],
  build: {
    target: 'esnext',
    cssCodeSplit: false,
    sourcemap: true,
    emptyOutDir: true,
    lib: {
      entry: './src/Panel.tsx', // Your plugin entry point
      formats: ['es'],
      fileName: () => 'Panel.js',
    },
    outDir: '../comic_scanner/static',
  },
  optimizeDeps: {
    exclude: Object.keys(externalLibs),
  },
});
