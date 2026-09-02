import { afterEach, describe, expect, it, vi } from 'vitest';
import { MUSICBRAINZ_REQUEST_INTERVAL_MS, MUSICBRAINZ_USER_AGENT } from './musicbrainz-const';
import { MusicBrainzExternalMetadataProvider } from './musicbrainz-provider';

const mbid = 'f509c5ff-ad54-4dde-b61e-24f750965835';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const release = {
  id: mbid,
  title: 'The Dark Side of the Moon',
  date: '1973-03-01',
  'artist-credit': [{ name: 'Pink Floyd' }],
  tags: [{ name: 'progressive rock' }],
};

describe('MusicBrainzExternalMetadataProvider', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('limits official MusicBrainz requests across provider instances', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ releases: [] })))
    );

    const firstRequest = new MusicBrainzExternalMetadataProvider().search('first');
    const secondRequest = new MusicBrainzExternalMetadataProvider().search('second');
    await vi.advanceTimersByTimeAsync(0);

    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(MUSICBRAINZ_REQUEST_INTERVAL_MS - 1);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    await Promise.all([firstRequest, secondRequest]);
  });

  it('maps search results using release MBIDs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ releases: [release] })));

    const result = await new MusicBrainzExternalMetadataProvider('https://music.example/').search('dark side');

    const requestUrl = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
    expect(`${requestUrl.origin}${requestUrl.pathname}`).toBe('https://music.example/release');
    expect(requestUrl.searchParams.get('query')).toBe('dark side AND status:official AND primarytype:album');
    expect(requestUrl.searchParams.get('fmt')).toBe('json');
    expect(requestUrl.searchParams.get('limit')).toBe('20');
    expect(vi.mocked(fetch).mock.calls[0][1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({ 'User-Agent': MUSICBRAINZ_USER_AGENT }),
      })
    );
    expect(result.results).toEqual([
      {
        provider: 'musicbrainz',
        providerItemId: mbid,
        externalIds: [{ source: 'musicbrainz', id: mbid }],
        title: 'The Dark Side of the Moon',
        year: '1973',
        contentType: 'album',
        poster: `https://coverartarchive.org/release/${mbid}/front-250`,
        plot: '',
        actors: 'Pink Floyd',
        genres: ['progressive rock'],
        ratings: [],
      },
    ]);
  });

  it('skips malformed search releases and nested metadata', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          releases: [null, { ...release, 'artist-credit': [null], tags: {}, 'release-group': { tags: {} } }],
        })
      )
    );

    const result = await new MusicBrainzExternalMetadataProvider('https://music.example/').search('dark side');

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toEqual(expect.objectContaining({ actors: '', genres: [] }));
  });

  it('looks up a release by MBID and uses a larger cover', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(release)));

    const item = await new MusicBrainzExternalMetadataProvider('https://music.example/').getItem(mbid.toUpperCase());

    const requestUrl = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
    expect(requestUrl.pathname).toBe(`/release/${mbid}`);
    expect(requestUrl.searchParams.get('inc')).toBe('artists+release-groups+tags+media');
    expect(item?.poster).toBe(`https://coverartarchive.org/release/${mbid}/front-500`);
    expect(item?.providerItemId).toBe(mbid);
  });

  it('returns null for invalid or missing MBIDs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new MusicBrainzExternalMetadataProvider('https://music.example/');

    await expect(provider.getItem('invalid')).resolves.toBeNull();
    await expect(provider.getItem(mbid)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns null for a null lookup response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(null)));

    await expect(new MusicBrainzExternalMetadataProvider('https://music.example/').getItem(mbid)).resolves.toBeNull();
  });

  it('loads exact MBID searches from the lookup endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(release)));

    const result = await new MusicBrainzExternalMetadataProvider().search(`https://musicbrainz.org/release/${mbid}`);

    expect(new URL(vi.mocked(fetch).mock.calls[0][0] as string).pathname).toBe(`/ws/2/release/${mbid}`);
    expect(result.results[0]?.providerItemId).toBe(mbid);
  });

  it('searches barcodes with a barcode query', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ releases: [release] })));

    await new MusicBrainzExternalMetadataProvider('https://music.example/').search('724383848429');

    expect(new URL(vi.mocked(fetch).mock.calls[0][0] as string).searchParams.get('query')).toBe('barcode:724383848429');
  });

  it('deduplicates search results by release-group', async () => {
    const otherRelease = {
      ...release,
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'release-group': { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' },
    };
    const remaster = {
      ...release,
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      'release-group': { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ releases: [otherRelease, remaster] })));

    const result = await new MusicBrainzExternalMetadataProvider('https://music.example/').search('dark side');

    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.providerItemId).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  });

  it('escapes quotes in album search queries', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ releases: [] })));

    await new MusicBrainzExternalMetadataProvider('https://music.example/').search('dark "side"');

    expect(new URL(vi.mocked(fetch).mock.calls[0][0] as string).searchParams.get('query')).toBe(
      'dark \\"side\\" AND status:official AND primarytype:album'
    );
  });

  it('keeps a custom base path without a trailing slash', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ releases: [] })));

    await new MusicBrainzExternalMetadataProvider('https://music.example/api').search('album');

    expect(new URL(vi.mocked(fetch).mock.calls[0][0] as string).pathname).toBe('/api/release');
  });
});
