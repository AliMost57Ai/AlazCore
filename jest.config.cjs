const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
  moduleNameMapper: {
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/pages/(.*)$': '<rootDir>/pages/$1',
  },
  // Turbopack dev artifacts (.next/dev/…) contain files that look like
  // package.json to the haste map but are not valid JSON.
  modulePathIgnorePatterns: ['<rootDir>/.next'],
  // پنل Core اپ مستقلی با node_modules خودش است — تست‌های فروشگاه نباید
  // فایل‌های آن را ببینند.
  testPathIgnorePatterns: ['<rootDir>/.next', '<rootDir>/core'],
  testEnvironment: 'jest-environment-jsdom',
};

module.exports = async () => {
  const config = await createJestConfig(customJestConfig)();
  // next/jest MERGES user transformIgnorePatterns after its defaults instead
  // of replacing them, and its first default still ignores every
  // node_modules package — including jalaliday, which ships ESM only and so
  // needs the Babel transform (FaDatePicker.test.tsx imports it). Patch that
  // first pattern to exempt jalaliday, same as it already exempts geist/next.
  config.transformIgnorePatterns[0] = config.transformIgnorePatterns[0].replace(
    '(?!(geist|',
    '(?!(geist|jalaliday|'
  );
  return config;
};
