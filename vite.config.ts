import {defineConfig, loadEnv} from 'vite';
import react from '@vitejs/plugin-react-swc';
import {viteStaticCopy} from 'vite-plugin-static-copy';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd());
  const appPort = Number(env.VITE_APP_PORT || 5173);

  return {
    server: {
      port: appPort,
      strictPort: true,
    },
    plugins: [
      react(),
      viteStaticCopy({
        targets: [
          {
            src: 'src/assets/*',
            dest: 'assets',
          },
        ],
      }),
    ],
  };
});
