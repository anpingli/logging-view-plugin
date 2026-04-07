import * as registerCypressGrep from '@cypress/grep';
import './commands/selector-commands';
import './commands/auth-commands';
import './commands/utility-commands';
import './commands/log-commands';

(registerCypressGrep as any)();

/**
 * Utility to check for custom window errors
 */
export const checkErrors = () => {
  cy.window().then((win) => {
    // Using a more descriptive assertion
    assert.isTrue(!win.windowError, `Found window error: ${win.windowError}`);
  });
};

/**
 * Global Exception Handling
 */
Cypress.on('uncaught:exception', (err) => {
  const message = err?.message || String(err || '');

  // 1. Define list of benign errors to ignore
  const ignoredErrors = [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'ResizeObserver',
    'Cannot read properties of undefined',
    'Unauthorized',
    'Bad Gateway',
    "Cannot read properties of null (reading 'default')",
    '(intermediate value) is not a function'
  ];

  // 2. Check if the current error matches any in our ignore list
  const isIgnored = ignoredErrors.some(msg => message.includes(msg));

  if (isIgnored) {
    console.warn('Ignored frontend exception:', message);
    return false; // Prevents Cypress from failing the test
  }

  // 3. Log and FAIL for any other unexpected errors
  console.error("Uncaught error (Failing test):", message);
  return true; // This allows Cypress to fail the test as it should
});
