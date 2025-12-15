import { inject, Injectable } from '@angular/core';
import { ApiService } from '@services/api/api-service';
import { getParserRegexp, getParserTemplate, setParserRegexp, setParserTemplate } from '@services/parser/parser-util';
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
          setParserRegexp('IMDbId', restoreSerializedParserRegexp(parserConfig.IMDbId!));
          setParserRegexp('genre', restoreSerializedParserRegexp(parserConfig.genre!));
          setParserRegexp('genreToken', restoreSerializedParserRegexp(parserConfig.genreToken!));
          setParserRegexp('image', restoreSerializedParserRegexp(parserConfig.image!));
          setParserRegexp('IMDbRate', restoreSerializedParserRegexp(parserConfig.IMDbRate!));
          setParserRegexp('tags', restoreSerializedParserRegexp(parserConfig.tags!));
          setParserRegexp('tagToken', restoreSerializedParserRegexp(parserConfig.tagToken!));
          setParserRegexp('title', restoreSerializedParserRegexp(parserConfig.title!));
          setParserRegexp('year', restoreSerializedParserRegexp(parserConfig.year!));
        }
      }),
      map(() => void 0)
    );
  }

  public syncUserParserConfig(): Observable<void> {
    const parserConfig: ParserConfigApiRequestModel = {
      mdTemplate: getParserTemplate(),
      IMDbId: serializeParserRegexp(getParserRegexp('IMDbId')),
      genre: serializeParserRegexp(getParserRegexp('genre')),
      genreToken: serializeParserRegexp(getParserRegexp('genreToken')),
      image: serializeParserRegexp(getParserRegexp('image')),
      IMDbRate: serializeParserRegexp(getParserRegexp('IMDbRate')),
      tags: serializeParserRegexp(getParserRegexp('tags')),
      tagToken: serializeParserRegexp(getParserRegexp('tagToken')),
      title: serializeParserRegexp(getParserRegexp('title')),
      year: serializeParserRegexp(getParserRegexp('year')),
    };

    return this.api.updateUserParserConfig(parserConfig);
  }
}
