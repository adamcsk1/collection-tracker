const REQUIRED_NON_EMPTY_VARIABLES = ['JWT_SECRET', 'COOKIE_SECRET'] as const;

export const validateEnvironment = (environment: NodeJS.ProcessEnv = process.env): void => {
  const missingVariables: string[] = REQUIRED_NON_EMPTY_VARIABLES.filter((name) => !environment[name]?.trim());

  // An explicitly empty salt preserves hashes created by legacy deployments that had no SALT configured.
  if (environment.SALT === undefined) missingVariables.push('SALT');

  if (missingVariables.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVariables.join(', ')}`);
  }
};
