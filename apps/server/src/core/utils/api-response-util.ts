import { API_PREFIX } from '@shared/constants/api-const';
import type { ApiProblemModel, ApiResponseModel, CursorPageModel } from '@shared/models/api-envelope-model';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { STATUS_CODES } from 'node:http';
import { getRequestPath } from './request-url-util';

const parseJson = (payload: string): unknown => {
  try {
    return JSON.parse(payload);
  } catch {
    return undefined;
  }
};

const getDetail = (payload: unknown): string | undefined => {
  if (typeof payload !== 'object' || payload === null) return undefined;

  const errorPayload = payload as Record<string, unknown>;
  if (typeof errorPayload.error === 'string') return errorPayload.error;
  if (typeof errorPayload.message === 'string') return errorPayload.message;
  return undefined;
};

const isPaginatedApiResponse = (payload: object): payload is { data: unknown[]; page: CursorPageModel } => {
  const value = payload as Record<string, unknown>;
  const page = value.page as Partial<CursorPageModel> | undefined;
  return (
    Object.hasOwn(value, 'data') &&
    Object.hasOwn(value, 'page') &&
    Array.isArray(value.data) &&
    typeof page === 'object' &&
    page !== null &&
    Number.isInteger(page.limit) &&
    Number(page.limit) > 0 &&
    ((page.hasMore === true && typeof page.nextCursor === 'string' && page.nextCursor.length > 0) ||
      (page.hasMore === false && page.nextCursor === null))
  );
};

export const apiResponseHook = async (
  request: FastifyRequest,
  response: FastifyReply,
  payload: unknown
): Promise<unknown> => {
  const requestPath = getRequestPath(request.url);
  if (requestPath !== API_PREFIX && !requestPath.startsWith(`${API_PREFIX}/`)) return payload;

  if (response.statusCode >= 400) {
    const existingPayload = typeof payload === 'string' ? parseJson(payload) : undefined;
    const problem: ApiProblemModel = {
      type: 'about:blank',
      title: STATUS_CODES[response.statusCode] ?? 'HTTP Error',
      status: response.statusCode,
      code: `HTTP_${response.statusCode}`,
      instance: requestPath,
    };
    const detail = response.statusCode === 500 ? undefined : getDetail(existingPayload);
    if (detail) problem.detail = detail;

    response.type('application/problem+json');
    response.removeHeader('content-length');
    return JSON.stringify(problem);
  }

  if (response.statusCode < 200 || response.statusCode >= 300 || response.statusCode === 204 || payload === null) {
    return payload;
  }

  const contentType = response.getHeader('content-type');
  if (typeof payload !== 'string' || typeof contentType !== 'string' || !contentType.includes('json')) return payload;

  const parsedPayload = parseJson(payload);
  if (typeof parsedPayload !== 'object' || parsedPayload === null) return payload;

  const envelope: ApiResponseModel<unknown> | { data: unknown[]; page: CursorPageModel } = isPaginatedApiResponse(
    parsedPayload
  )
    ? parsedPayload
    : { data: parsedPayload };
  response.removeHeader('content-length');
  return JSON.stringify(envelope);
};
