import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteExternalsPlugin } from 'vite-plugin-externals';

/**
 * The following libraries are externalized to avoid bundling them with the plugin.
 * These libraries are provided by the InvenTree core application.
 */
export const externalLibs: Record<string, string> = {
  react: 'React',
  'react-dom': 'ReactDOM',
  ReactDom: 'ReactDOM',
  'react/jsx-runtime': 'React',
  '@lingui/core': 'LinguiCore',
  '@lingui/react': 'LinguiReact',
  '@mantine/core': 'MantineCore',
  '@mantine/notifications': 'MantineNotifications'
};

// Just the keys of the externalLibs object
const externalKeys = Object.keys(externalLibs);

/**
 * Vite config to build the frontend plugin as an exported module.
 * Distributed in the 'static' directory of the plugin.
 */
export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'classic'
    }),
    viteExternalsPlugin(externalLibs)
  ],
  // FIX 2: Removed `esbuild: { jsx: 'preserve' }` so JSX compiles to standard JS
  build: {
    target: 'esnext',
    cssCodeSplit: false,
    manifest: true,
    sourcemap: true,
    rollupOptions: {
      preserveEntrySignatures: 'exports-only',
      input: ['./src/Panel.tsx'],
      output: {
        dir: '../comic_scanner/static',
        entryFileNames: '[name].js',
        assetFileNames: 'assets/[name].[ext]',
        globals: externalLibs
      },
      external: externalKeys
    }
  },
  optimizeDeps: {
    exclude: externalKeys
  }
});
