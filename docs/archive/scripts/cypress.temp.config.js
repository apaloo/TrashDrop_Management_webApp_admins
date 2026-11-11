const { defineConfig } = require('cypress')

module.exports = defineConfig({
  projectId: 'ad5ygb',
  e2e: {
    baseUrl: null,
    supportFile: 'cypress/support/e2e.js',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    experimentalWebKitSupport: true
  },
})
