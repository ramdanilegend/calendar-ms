/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  setupFilesAfterEnv: ['./jest.setup.js'],
  // Force sequential execution to avoid database conflicts
  maxWorkers: 1,
  // Add timeout and handle cleanup
  testTimeout: 10000,
  // Detect open handles to help debug hanging issues
  detectOpenHandles: true,
  // Force exit after tests complete
  forceExit: true,
  // Collect coverage for better test insights
  collectCoverage: true,
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/',
    '/dist/'
  ]
};
