import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@server/protocol': path.resolve(__dirname, '../server/src/protocol.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/multiplayer/__tests__/**/*.test.ts',
      'src/lib/__tests__/**/*.test.ts',
      'src/engine/__tests__/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      include: [
        'src/multiplayer/**/*.ts',
        'src/lib/**/*.ts',
        'src/engine/**/*.ts',
      ],
      exclude: [
        'src/**/__tests__/**',
        'src/engine/Engine.ts',
        'src/engine/index.ts',
        'src/engine/render/**',
        'src/engine/camera/**',
        'src/engine/textures/BaseTexture.ts',
        'src/engine/textures/Texture.ts',
        'src/engine/textures/TextureManager.ts',
        'src/engine/textures/AtlasPacker.ts',
        'src/engine/assets/AssetLoader.ts',
        'src/engine/interaction/InteractionManager.ts',
        'src/engine/nodes/Graphics.ts',
        'src/engine/nodes/Text.ts',
        'src/engine/nodes/ParticleContainer.ts',
      ],
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },
})
