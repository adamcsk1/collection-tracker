// Placeholder for environment setup before Cypress tests run.
// This file is imported from support/e2e.ts so it executes before every spec.
// Add your custom initialization logic here (e.g., seeding data, resetting state).

export const setupTestEnvironment = () => {
  // TODO: implement environment bootstrapping
  // For example: call a reset endpoint, seed database, or set auth tokens.
};

// Run the hook immediately so any setup is applied once on load.
setupTestEnvironment();
