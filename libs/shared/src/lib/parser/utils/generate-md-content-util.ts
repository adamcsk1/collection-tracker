import type { OMDbResponseItemModel } from '../../models/omdb-model';

export const generateMdContent = (template: string, omdbData: OMDbResponseItemModel & { Tags: string }): string => {
  let content = template;

  for (const [key, value] of Object.entries(omdbData)) {
    content = content.replaceAll(`{{${key}}}`, String(value));
  }

  content = content.replace('{{YoutubeQuery}}', encodeURIComponent(`${omdbData.Title} ${omdbData.Year} trailer`));
  content = content.replace('{{WebQuery}}', encodeURIComponent(`${omdbData.Title} ${omdbData.Year}`));

  return content;
};
