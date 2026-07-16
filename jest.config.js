module.exports = {
  testEnvironment: 'node',

  testMatch: [
    '**/tests/**/*.test.js'
  ],

  collectCoverageFrom: [
    'src/**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**'
  ],

  coverageDirectory: 'coverage',

  coverageReporters: [
    'html',
    'lcov',
    'text-summary'
  ],

  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'coverage',
        outputName: 'junit.xml'
      }
    ]
  ],

  verbose: true
};