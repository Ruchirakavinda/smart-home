// jest.config.cjs
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node', 
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
};
