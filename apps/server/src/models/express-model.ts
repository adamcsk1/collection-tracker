export {};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      username: string;
      usernameHash: string;
    }
  }
}
