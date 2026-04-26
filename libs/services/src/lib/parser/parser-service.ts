import { inject, Injectable } from '@angular/core';
import { ApiService } from '../api/api-service';
import { getParserFilenamePattern, getParserRegexp, getParserTemplate } from '@shared/parser/parser-util';
import { applyParserConfig } from '@shared/parser/apply-parser-config-util';
import { ParserConfigApiRequestModel } from '@shared/models/api-model';
import { serializeParserRegexp } from '@shared/utils/parser-serialize-util';
import { map, Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ParserService {
  public readonly api = inject(ApiService);

  public preloadUserParserConfig(): Observable<void> {
    return this.api.getUserParserConfig().pipe(
      tap((parserConfig) => {
        if (parserConfig) applyParserConfig(parserConfig);
      }),
      map(() => void 0)
    );
  }

  public syncUserParserConfig(): Observable<void> {
    const parserConfig: ParserConfigApiRequestModel = {
      mdTemplate: getParserTemplate(),
      filenamePattern: getParserFilenamePattern(),
      IMDbId: serializeParserRegexp(getParserRegexp('IMDbId')),
      genre: serializeParserRegexp(getParserRegexp('genre')),
      genreToken: serializeParserRegexp(getParserRegexp('genreToken')),
      image: serializeParserRegexp(getParserRegexp('image')),
      IMDbRate: serializeParserRegexp(getParserRegexp('IMDbRate')),
      tags: serializeParserRegexp(getParserRegexp('tags')),
      tagToken: serializeParserRegexp(getParserRegexp('tagToken')),
      title: serializeParserRegexp(getParserRegexp('title')),
      year: serializeParserRegexp(getParserRegexp('year')),
      content: serializeParserRegexp(getParserRegexp('content')),
    };

    return this.api.updateUserParserConfig(parserConfig);
  }
}
