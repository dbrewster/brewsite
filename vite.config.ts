import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['localhost', '127.0.0.1', 'local.brewblast.ai'],
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      reportsDirectory: './coverage',
      include: [
        'src/robot/model/**/*.ts',
        'src/robot/scenes/**/*.ts',
        'src/robot/robotTimeline*.ts',
        'src/robot/runtime/**/*.ts',
        'src/robot/elements/**/*.ts',
      ],
      exclude: [
        'src/robot/model/robotSceneTypes.ts',
        'src/robot/model/robotMotionTypes.ts',
        'src/robot/scenes/sceneTypes.ts',
        'src/robot/scenes/sceneDefaults.ts',
        'src/robot/runtime/mocks/**/*.ts',
        // Three.js files — cannot instrument in Node test environment
        'src/robot/elements/**/render.ts',
        'src/robot/elements/**/Three*.ts',
        'src/robot/elements/**/Mock*.ts',
        // Barrel files — no logic to test
        'src/robot/elements/**/index.ts',
      ],
    },
  },
});
