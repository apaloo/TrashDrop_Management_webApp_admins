const { defineConfig } = require('cypress')

module.exports = defineConfig({
  e2e: {
    baseUrl: null,
    experimentalModifyObstructiveThirdPartyCode: true,
    experimentalMemoryManagement: true,
    defaultCommandTimeout: 10000,
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
})
