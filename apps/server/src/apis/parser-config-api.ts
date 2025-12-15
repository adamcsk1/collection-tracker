import { jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { Store } from '@server/core/store/store';
import { ExtendedRequestModel } from '@server/models/express-model';
import { API_PREFIX } from '@shared/constants/api-const';
import { MD_TEMPLATE, PARSER_REGEXPS } from '@shared/constants/parser-const';
import { ParserConfigApiResponseModel } from '@shared/models/api-model';
import { serializeParserRegexp } from '@shared/utils/parser-serialize-util';

Store.getOnce$('app').subscribe((app) =>
  app.get(`${API_PREFIX}/parser/config`, jwtGuard, (request: ExtendedRequestModel, response) => {
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
      };
      response.send(result);
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  })
);
