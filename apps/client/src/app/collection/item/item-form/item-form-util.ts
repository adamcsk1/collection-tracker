import { CollectionItemChangeApiModel } from '@shared/models/api-model';
import { ExternalMetadataProviderNameModel } from '@shared/models/external-metadata-provider-model';
import { parseGenreText, parseTagText } from '@shared/utils/collection-item-text-util';
import { isImdbShapedExternalItemId, mergeImdbExternalId } from '@shared/utils/external-metadata-identity-util';
import { normalizeIMDbRating } from '@shared/utils/external-metadata-ratings-util';
import { normalizeIsbn13 } from '@shared/utils/isbn-util';
import { ItemFormModel } from './item-form-model';
export type { ItemFormModel } from './item-form-model';

const imdbRatePattern = /^(?:N\/A|10(?:\.0)?|[0-9](?:\.[0-9])?)$/;
const rottenTomatoesRatePattern = /^(?:100|[1-9]?\d)%$/;
const metacriticRatePattern = /^(?:100|[1-9]?\d)\/100$/;

export const validateOptionalIMDbRateFormat = (value: string) => optionalRateFormatValidation(value, imdbRatePattern);

export const validateOptionalRottenTomatoesRateFormat = (value: string) =>
  optionalRateFormatValidation(value, rottenTomatoesRatePattern);

export const validateOptionalMetacriticRateFormat = (value: string) =>
  optionalRateFormatValidation(value, metacriticRatePattern);

const optionalRateFormatValidation = (value: string, pattern: RegExp) => {
  if (!value) return undefined;
  return pattern.test(value) ? undefined : { kind: 'rateFormat' };
};

export const buildItemFromForm = (
  formValues: ItemFormModel,
  options: {
    externalProvider?: ExternalMetadataProviderNameModel;
    externalItemId?: string;
    externalIds?: { source: 'imdb' | 'isbn' | 'omdb' | 'openlibrary'; id: string }[];
    favorite?: boolean;
  } = {}
): CollectionItemChangeApiModel => {
  if (formValues.contentType === 'book') {
    const isbn = normalizeIsbn13(options.externalItemId ?? formValues.IMDbId) ?? '';
    return {
      title: formValues.title.trim(),
      IMDbId: undefined,
      externalProvider: 'openlibrary',
      externalItemId: isbn,
      externalIds: isbn ? [{ source: 'isbn', id: isbn }] : undefined,
      year: formValues.year,
      rate: '',
      rottenTomatoesRate: '',
      metacriticRate: '',
      userRate: formValues.userRate,
      image: formValues.image,
      genre: parseGenreText(formValues.genreText),
      tags: parseTagText(formValues.tagsText),
      actors: formValues.actors,
      plot: formValues.plot,
      contentType: 'book',
      favorite: options.favorite ?? false,
    };
  }

  const imdbId = formValues.IMDbId.trim();
  const externalProvider: ExternalMetadataProviderNameModel = options.externalProvider ?? 'omdb';
  const externalItemId = options.externalItemId ?? imdbId;
  const externalIds =
    options.externalIds ?? (mergeImdbExternalId([], imdbId) as { source: 'imdb'; id: string }[] | undefined);
  return {
    title: formValues.title.trim(),
    IMDbId: imdbId,
    externalProvider,
    externalItemId,
    externalIds,
    year: formValues.year,
    rate: formValues.rate,
    rottenTomatoesRate: formValues.rottenTomatoesRate,
    metacriticRate: formValues.metacriticRate,
    userRate: formValues.userRate,
    image: formValues.image,
    genre: parseGenreText(formValues.genreText),
    tags: parseTagText(formValues.tagsText),
    actors: formValues.actors,
    plot: formValues.plot,
    contentType: formValues.contentType,
    favorite: options.favorite ?? false,
  };
};

export const buildItemFormFromChange = (item: CollectionItemChangeApiModel): ItemFormModel => ({
  title: item.title,
  IMDbId: item.IMDbId ?? item.externalItemId,
  year: item.year,
  rate: normalizeIMDbRating(item.rate),
  rottenTomatoesRate: item.rottenTomatoesRate,
  metacriticRate: item.metacriticRate,
  userRate: item.userRate,
  image: item.image,
  genreText: item.genre.join(', '),
  tagsText: item.tags.join(' '),
  actors: item.actors,
  plot: item.plot,
  contentType: item.contentType,
});

export const isImdbIdValid = (imdbId: string): boolean => isImdbShapedExternalItemId(imdbId);

export const isIsbnValid = (isbn: string): boolean => normalizeIsbn13(isbn) !== null;
