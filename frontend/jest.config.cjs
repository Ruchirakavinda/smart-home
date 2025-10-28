module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy', 
    '^react-router$': '<rootDir>/node_modules/react-router', 
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};
