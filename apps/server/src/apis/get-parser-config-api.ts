import { jwtGuard } from '../core/jwt';
import { errorLog } from '../core/logger';
import { Store } from '../core/store/store';
import { API_PREFIX } from '@shared/constants/api-const';
import { FILENAME_PATTERN, MD_TEMPLATE, PARSER_REGEXPS } from '@shared/constants/parser-const';
import { ParserConfigApiResponseModel } from '@shared/models/api-model';
import { serializeParserRegexp } from '@shared/utils/parser-serialize-util';
import type { Application, Request, Response } from 'express';

export const register = (app: Application): void => {
  app.get(`${API_PREFIX}/parser/config`, jwtGuard, (request: Request, response: Response) => {
    try {
      const parserConfigs = Store.getLastValue('parserConfigs');
      const result: ParserConfigApiResponseModel = parserConfigs?.[request.usernameHash] || {
        mdTemplate: MD_TEMPLATE,
        IMDbId: serializeParserRegexp(PARSER_REGEXPS.IMDbId),
        genre: serializeParserRegexp(PARSER_REGEXPS.genre),
        genreToken: serializeParserRegexp(PARSER_REGEXPS.genreToken),
        image: serializeParserRegexp(PARSER_REGEXPS.image),
        IMDbRate: serializeParserRegexp(PARSER_REGEXPS.IMDbRate),
        tags: serializeParserRegexp(PARSER_REGEXPS.tags),
        tagToken: serializeParserRegexp(PARSER_REGEXPS.tagToken),
        title: serializeParserRegexp(PARSER_REGEXPS.title),
        year: serializeParserRegexp(PARSER_REGEXPS.year),
        content: serializeParserRegexp(PARSER_REGEXPS.content),
        filenamePattern: FILENAME_PATTERN,
      };
      response.send(result);
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  });
};
