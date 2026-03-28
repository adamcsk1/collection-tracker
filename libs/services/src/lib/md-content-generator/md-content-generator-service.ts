import { Injectable } from '@angular/core';
import { getParserTemplate } from '@services/parser/parser-util';
import { OMDbResponseItemModel } from '@shared/models/omdb-model';

@Injectable()
export class MdContentGeneratorService {
  public getMdContent(omdbData: OMDbResponseItemModel & { Tags: string; }): string {
    let resultContent = getParserTemplate();

    for (const [key, value] of Object.entries(omdbData)) {
      resultContent = resultContent.replaceAll(`{{${key}}}`, value);
    }

    resultContent = resultContent.replace(
      '{{YoutubeQuery}}',
      encodeURIComponent(`${omdbData.Title} ${omdbData.Year} trailer`),
    );
    resultContent = resultContent.replace('{{WebQuery}}', encodeURIComponent(`${omdbData.Title} ${omdbData.Year}`));

    return resultContent;
  }
}
