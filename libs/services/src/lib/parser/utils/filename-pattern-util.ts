import { OMDbResponseItemModel } from '@shared/models/omdb-model';
import dayjs from 'dayjs';

export const buildCollectionItemFilename = ({
  pattern,
  selectedContent,
}: {
  pattern: string;
  selectedContent: OMDbResponseItemModel;
}): string => {
  const resolvedValues: Record<string, string> = {
    ...Object.fromEntries(Object.entries(selectedContent).map(([key, value]) => [key, getClearedName(value)])),
    ClearedName: getClearedName(selectedContent.Title),
  };

  return pattern.replaceAll(/{{([^}]+)}}/g, (placeholder, key: string) => resolvedValues[key] ?? placeholder);
};

const getClearedName = (value: string): string => {
  const defaultName = `${dayjs().toISOString().replaceAll(':', '-').replaceAll('.', '-')}`;

  try {
    const clearedName = value
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .replace(/[_\s-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return clearedName || defaultName;
  } catch {
    return defaultName;
  }
};
