export const metadataServiceResponse = (data: unknown, status = 200): Response =>
  new Response(status === 200 ? JSON.stringify({ data }) : null, {
    status,
    headers: status === 200 ? { 'content-type': 'application/json' } : undefined,
  });

export const metadataServiceItem = (
  providerItemId: string,
  extra: Record<string, unknown> = {}
): Record<string, unknown> => ({
  providerItemId,
  title: extra.title ?? 'Title',
  year: extra.year ?? '2024',
  contentType: extra.contentType ?? 'movie',
  poster: extra.poster ?? 'https://images.test/poster.jpg',
  plot: extra.plot ?? 'Plot',
  actors: extra.actors ?? 'Actor',
  genres: extra.genres ?? ['Drama'],
  ratings: extra.ratings ?? [],
  ...extra,
});
