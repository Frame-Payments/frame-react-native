/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  modulePathIgnorePatterns: ['<rootDir>/lib/'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}'],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': [
      'ts-jest',
      {
        useESM: false,
        diagnostics: false,
        // Override tsconfig's jsx: 'react-native' (preserves JSX for metro) so
        // ts-jest emits transformed JSX that runs in jest's node runtime.
        tsconfig: { jsx: 'react-jsx' },
      },
    ],
  },
  // framepayments ships ESM; transform it so jest's CJS runtime can require it.
  // react-native + @react-native/* also ship Flow + ESM and need the same.
  transformIgnorePatterns: ['node_modules/(?!(framepayments|react-native|@react-native)/)'],
};
