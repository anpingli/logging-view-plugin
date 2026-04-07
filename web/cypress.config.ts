import { defineConfig } from 'cypress';
const fs = require('fs');
const path = require('path');

const report_dir = process.env.ARTIFACT_DIR || '/tmp';

export default defineConfig({
  screenshotsFolder: path.join(report_dir, 'cypress', 'screenshots'),
  screenshotOnRunFailure: true,
  trashAssetsBeforeRuns: true,
  videosFolder: path.join(report_dir, 'cypress', 'videos'),
  // Set global video preference here or inside e2e
  video: false, 
  videoCompression: false,
  reporter: './node_modules/cypress-multi-reporters',
  reporterOptions: {
    reporterEnabled: 'mocha-junit-reporter, mochawesome',
    mochaJunitReporterReporterOptions: {
      mochaFile: path.join(report_dir, 'junit_cypress-[hash].xml'),
      toConsole: false
    },
    mochawesomeReporterOptions: {
      reportDir: report_dir,
      reportFilename: 'cypress_report',
      overwrite: false,
      html: false,
      json: true
    }
  },
  env: {
    grepFilterSpecs: true, 
    'KUBECONFIG_PATH': process.env.KUBECONFIG,
    'NOO_CS_IMAGE': process.env.MULTISTAGE_PARAM_OVERRIDE_CYPRESS_NOO_CS_IMAGE,
    'OPENSHIFT_VERSION': process.env.CYPRESS_OPENSHIFT_VERSION,
  },
  fixturesFolder: 'fixtures',
  defaultCommandTimeout: 30000,
  retries: {
    runMode: 0,
    openMode: 0,
  },
  viewportWidth: 1600,
  viewportHeight: 1200,
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || process.env.BASE_URL || 'http://localhost:9003',
    setupNodeEvents(on, config) {
      require('@cypress/code-coverage/task')(on, config);

      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.family === 'chromium' && browser.name !== 'electron') {
          launchOptions.args.push('--enable-precise-memory-info');
        }
        return launchOptions;
      });

      on('task', {
        log(message) { console.log(message); return null; },
        logError(message) { console.error(message); return null; },
        logTable(data) { console.table(data); return null; },
        readFileIfExists(filename) {
          if (fs.existsSync(filename)) {
            return fs.readFileSync(filename, 'utf8');
          }
          return null;
        },
      });

      on('after:screenshot', (details) => {
        const pathObj = path.parse(details.path);
        const files = fs.readdirSync(pathObj.dir); // Use Sync for simplicity here
        const newPath = path.join(pathObj.dir, `${files.length}_${pathObj.base}`);
        
        return new Promise((resolve, reject) => {
          fs.rename(details.path, newPath, (err) => {
            if (err) return reject(err);
            resolve({ path: newPath });
          });
        });
      });

      on('after:spec', (spec, results) => {
        if (results && results.video) {
          const failures = results.tests.some((test) =>
            test.attempts.some((attempt) => attempt.state === 'failed')
          );
          if (!failures && fs.existsSync(results.video)) {
            fs.unlinkSync(results.video);
          }
        }
      });

      // IMPORTANT: Always return config at the very end
      require('@cypress/grep/src/plugin')(config);
      return config;
    },
    supportFile: './cypress/support/e2e.ts',
    specPattern: './cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    numTestsKeptInMemory: 1,
    testIsolation: false,
    experimentalModifyObstructiveThirdPartyCode: true,
    experimentalOriginDependencies: true,
    experimentalMemoryManagement: true,
    experimentalCspAllowList: ['default-src', 'script-src']
  }
});
