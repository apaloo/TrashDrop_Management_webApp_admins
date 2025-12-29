const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    // Allow running tests without a baseUrl for fixture-based tests
    baseUrl: null,
    setupNodeEvents(on, config) {
      // implement node event listeners here

      // Allow running without a server
      on("before:browser:launch", (browser, launchOptions) => {
        if (browser.name === "chrome" || browser.name === "edge") {
          launchOptions.args.push("--disable-web-security");
        }
        return launchOptions;
      });
    },
    // Increase timeout for tests
    defaultCommandTimeout: 15000,
    viewportWidth: 1280,
    viewportHeight: 800,
    // Configure test isolation
    testIsolation: true,
    // Don't fail tests when uncaught errors occur
    experimentalWebKitSupport: true,
    // Add additional configuration
    chromeWebSecurity: false,
    includeShadowDom: true,
    video: false,
    screenshotOnRunFailure: true,
  },

  component: {
    devServer: {
      framework: "react",
      bundler: "webpack",
    },
  },
});
