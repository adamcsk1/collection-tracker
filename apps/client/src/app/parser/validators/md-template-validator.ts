export type MdTemplateValidationError = {
  kind: 'mdTemplate';
  missingKeys: string;
};

export const mdTemplateValidationError = (template: string): MdTemplateValidationError | undefined => {
  const missingKeys: string[] = [];
  if (!template.includes('{{Title}}')) {
    missingKeys.push('{{Title}}');
  }
  if (!template.includes('{{imdbID}}')) {
    missingKeys.push('{{imdbID}}');
  }
  if (!template.includes('{{imdbRating}}')) {
    missingKeys.push('{{imdbRating}}');
  }
  if (!template.includes('{{Plot}}')) {
    missingKeys.push('{{Plot}}');
  }
  if (!template.includes('{{Poster}}')) {
    missingKeys.push('{{Poster}}');
  }
  if (!template.includes('{{Year}}')) {
    missingKeys.push('{{Year}}');
  }
  if (!template.includes('{{Director}}')) {
    missingKeys.push('{{Director}}');
  }
  if (!template.includes('{{Genre}}')) {
    missingKeys.push('{{Genre}}');
  }
  if (!template.includes('{{Actors}}')) {
    missingKeys.push('{{Actors}}');
  }
  if (!template.includes('{{YoutubeQuery}}')) {
    missingKeys.push('{{YoutubeQuery}}');
  }
  if (!template.includes('{{WebQuery}}')) {
    missingKeys.push('{{WebQuery}}');
  }
  if (!template.includes('{{Type}}')) {
    missingKeys.push('{{Type}}');
  }
  if (!template.includes('{{Tags}}')) {
    missingKeys.push('{{Tags}}');
  }

  return missingKeys.length > 0 ? { kind: 'mdTemplate', missingKeys: missingKeys.join(', ') } : undefined;
};
