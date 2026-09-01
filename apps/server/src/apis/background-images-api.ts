import { API_PREFIX } from '@shared/constants/api-const';
import type { FastifyInstance } from 'fastify';
import { IMAGE_RATE_LIMIT_GROUP_ID } from '../core/constants/rate-limit-const';
import { getCachedBackgroundImageUrls, warmBackgroundImages } from '../core/background/background';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { getGroupedRateLimitHook, getImageRateLimit } from '../core/utils/rate-limit-util';

export const register = (app: FastifyInstance): void => {
  const rateLimit = getImageRateLimit();
  app.get(
    `${API_PREFIX}/images/background`,
    {
      preHandler: getGroupedRateLimitHook(app, IMAGE_RATE_LIMIT_GROUP_ID, rateLimit),
      config: { rateLimit: { max: rateLimit, timeWindow: '1 minute', groupId: IMAGE_RATE_LIMIT_GROUP_ID } },
    },
    withErrorHandler(async (_request, response) => {
      await warmBackgroundImages();
      response.send({ images: await getCachedBackgroundImageUrls() });
    })
  );
};
