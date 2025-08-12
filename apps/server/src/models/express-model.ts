import express from 'express';

export type ExtendedRequestModel = express.Request & { username: string; usernameHash: string };
