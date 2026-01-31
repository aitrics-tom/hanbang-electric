import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/lib/ai/agents/index.ts',
        'src/lib/guardrails/config.ts',
        'src/lib/utils/parseStepContent.ts',
        'src/lib/services/solver.service.ts',
        'src/lib/services/ocr.service.ts',
        'src/hooks/useSolveProblem.ts',
        'src/app/api/solve/route.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
