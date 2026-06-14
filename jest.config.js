module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^obsidian$': '<rootDir>/test/__mocks__/obsidian.ts'
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts']
};