import { API_PREFIX } from '@shared/constants/api-const';
import type { Application } from 'express';

export const register = (app: Application): void => {
  app.get(`${API_PREFIX}/health`, (req, res) => res.send({ message: 'Ok' }));
};
