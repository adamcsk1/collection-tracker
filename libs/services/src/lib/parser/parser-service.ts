import { inject, Injectable } from '@angular/core';
import { ApiService } from '../api/api-service';
import {
  getParserFilenamePattern,
  getParserRegexp,
  getParserTemplate,
  setParserFilenamePattern,
  setParserRegexp,
  setParserTemplate,
} from './parser-util';
import { ParserConfigApiRequestModel } from '@shared/models/api-model';
import { restoreSerializedParserRegexp, serializeParserRegexp } from '@shared/utils/parser-serialize-util';
import { map, Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ParserService {
  public readonly api = inject(ApiService);

  public preloadUserParserConfig(): Observable<void> {
    return this.api.getUserParserConfig().pipe(
      tap((parserConfig) => {
        if (parserConfig) {
          setParserTemplate(parserConfig.mdTemplate!);
          setParserFilenamePattern(parserConfig.filenamePattern!);
          setParserRegexp('IMDbId', restoreSerializedParserRegexp(parserConfig.IMDbId!));
          setParserRegexp('genre', restoreSerializedParserRegexp(parserConfig.genre!));
          setParserRegexp('genreToken', restoreSerializedParserRegexp(parserConfig.genreToken!));
          setParserRegexp('image', restoreSerializedParserRegexp(parserConfig.image!));
          setParserRegexp('IMDbRate', restoreSerializedParserRegexp(parserConfig.IMDbRate!));
          setParserRegexp('tags', restoreSerializedParserRegexp(parserConfig.tags!));
          setParserRegexp('tagToken', restoreSerializedParserRegexp(parserConfig.tagToken!));
          setParserRegexp('title', restoreSerializedParserRegexp(parserConfig.title!));
          setParserRegexp('year', restoreSerializedParserRegexp(parserConfig.year!));
          setParserRegexp('content', restoreSerializedParserRegexp(parserConfig.content!));
        }
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
