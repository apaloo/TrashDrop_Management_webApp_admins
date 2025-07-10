/* eslint-env worker */
module.exports = {
  env: {
    worker: true,
    browser: true,
    es2021: true,
    serviceworker: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
  ],
  plugins: ['import'],
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
  },
  globals: {
    // Worker globals
    self: 'readonly',
    importScripts: 'readonly',
    onmessage: 'readonly',
    postMessage: 'readonly',
    addEventListener: 'readonly',
    removeEventListener: 'readonly',
    close: 'readonly',
    
    // Standard globals
    globalThis: 'readonly',
    
    // Library globals
    JSZip: 'readonly',
  },
  rules: {
    // Disable rules that don't work well with workers
    'no-restricted-globals': ['error', {
      name: 'window',
      message: 'Use `self` instead of `window` in web workers.',
    }, {
      name: 'document',
      message: '`document` is not available in web workers.',
    }],
    'no-undef': 'off',
    
    // Custom rules
    'no-unused-vars': ['warn', { 
      vars: 'all', 
      args: 'after-used', 
      ignoreRestSiblings: true,
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    
    // Ensure we don't have any console statements in production
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    
    // Import rules
    'import/no-webpack-loader-syntax': 'off',
    'import/no-unresolved': 'off',
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  // Override rules for test files
  overrides: [
    {
      files: ['**/*.test.js', '**/*.spec.js'],
      env: {
        jest: true,
      },
    },
  ],
};
