import { Injectable } from '@angular/core';
import { OMDbResponseItemModel } from '@lib/services/omdb/omdb-model';

const MD_TEMPLATE = `### {{Title}}
[IMDb ({{imdbID}})](https://www.imdb.com/title/{{imdbID}}/) (**{{imdbRating}}** / 10)
{{Plot}}
![poster\|90]({{Poster}})

**Year**
{{Year}}
**Director**
{{Director}}
**Genre**
{{Genre}}
**Actors**
{{Actors}}
**Trailer**
[YouTube](https://www.youtube.com/results?search_query={{YoutubeQuery}})
**Web**
[DuckDuckGo](https://duckduckgo.com/?q={{WebQuery}})
**Tags**
#{{Type}} {{Tags}}
`;

@Injectable()
export class MdContentGeneratorService {
  public getMdContent(omdbData: OMDbResponseItemModel & { Tags: string }): string {
    let resultContent = MD_TEMPLATE;

    for (const [key, value] of Object.entries(omdbData)) {
      resultContent = resultContent.replaceAll(`{{${key}}}`, value);
    }

    resultContent = resultContent.replace(
      '{{YoutubeQuery}}',
      encodeURIComponent(`${omdbData.Title} ${omdbData.Year} trailer`)
    );
    resultContent = resultContent.replace('{{WebQuery}}', encodeURIComponent(`${omdbData.Title} ${omdbData.Year}`));

    return resultContent;
  }
}
