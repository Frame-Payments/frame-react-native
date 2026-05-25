/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  modulePathIgnorePatterns: ['<rootDir>/lib/', '<rootDir>/example/', '<rootDir>/expo-example/'],
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
  // react-native-svg's source imports `Touchable.Mixin` from react-native which
  // doesn't exist in the jest node runtime. Map it to a stub so screens that
  // pull Icon → SvgXml can still be loaded under tests.
  moduleNameMapper: {
    '^react-native-svg$': '<rootDir>/src/__mocks__/react-native-svg.ts',
  },
};
