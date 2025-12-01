import {defineWorkspace} from 'vitest/config';

export default defineWorkspace([
  {
    extends: './vite.config.ts',
    test: {
      name: 'unit',
      include: ['**/*.unit.test.ts?(x)'],
      exclude: ['functions/**/*.unit.test.ts'],
      environment: 'jsdom',
      setupFiles: ['vitest.setup.unit.ts'],
    },
  },
  {
    test: {
      name: 'unit-node',
      include: ['functions/**/*.unit.test.ts'],
      environment: 'node',
    },
  },
  {
    extends: './vite.config.ts',
    test: {
      name: 'integration',
      include: ['**/*.integration.test.ts?(x)'],
      environment: 'jsdom',
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },
    },
  },
]);
