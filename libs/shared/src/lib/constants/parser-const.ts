export const PARSER_REGEXPS = {
  IMDbId: /(?<id>tt\d+)/,
  genre: /\*\*Genre\*\*\s*(?<genre>[^\n]*)\s*\n\*\*Actors\*\*/,
  genreToken: /[^,\s][^,]*/g,
  image: /\[poster\|90]\((?<image>[^)]*)\)/,
  IMDbRate: /\[IMDb \(tt\d+\)\]\([^)]*\) \(\*\*(?<rate>\d+(?:\.\d+)?)\*\* \/ \d+(?:\.\d+)?\)/,
  tags: /\*\*Tags\*\*\s*(?<tags>.*)/,
  tagToken: /\S+/g,
  title: /#{3}\s(?<title>.*)/,
  year: /\*\*Year\*\*\s*(?<year>\d+)\s*/,
};

export const MD_TEMPLATE = `### {{Title}}
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

export const FILENAME_PATTERN = '{{Year}}-{{Type}}-{{Title}}.md';
