import { readFile, writeFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { buildCollectionItem } from '../fixtures/collection-item';
import { createExportImportPage } from '../page-objects/export-import.po';
import { expect, test } from '../support/test';

let exportImportPage: ReturnType<typeof createExportImportPage>;

test.beforeEach(async ({ page }) => {
  exportImportPage = createExportImportPage(page);
});

const waitForApiResponse = (page: Page, method: string, urlPart: string) =>
  page.waitForResponse((response) => response.request().method() === method && response.url().includes(urlPart));

const buildItemWithCustomTag = (title: string, customTag: string) => {
  const item = buildCollectionItem(title, 'movie');
  return { ...item, tags: [...item.tags, customTag] };
};

const buildTagManagement = (
  tag: string,
  overrides: Partial<{
    color: string | null;
    useForImageBorder: boolean;
    useForTextColor: boolean;
    useForImageBadge: boolean;
    weight: number;
  }> = {}
) => ({
  tag,
  color: null,
  useForImageBorder: false,
  useForTextColor: false,
  useForImageBadge: false,
  weight: 0,
  ...overrides,
});

test.describe('Export/Import — tag management export and import', () => {
  const existingTag = `#export-existing-${Date.now()}`;
  const importedTag = `#export-imported-${Date.now()}`;
  const item = {
    ...buildItemWithCustomTag('Import Export Tag Management Movie', existingTag),
    tags: [existingTag, importedTag],
  };
  const exportedExistingConfig = buildTagManagement(existingTag, {
    color: '#111111',
    useForImageBorder: true,
    weight: 3,
  });
  const exportedImportedConfig = buildTagManagement(importedTag, {
    color: '#222222',
    useForImageBadge: true,
    weight: 2,
  });
  const localExistingConfig = buildTagManagement(existingTag, {
    color: '#999999',
    useForTextColor: true,
    weight: 9,
  });

  test.beforeEach(async ({ api, autoLogin, page }) => {
    await autoLogin();
    await api.request('POST', '/api/v1/users/me/tags', []);
    await api.request('POST', '/api/v1/collection-items', item);
    await api.request('POST', '/api/v1/users/me/tags', [exportedExistingConfig, exportedImportedConfig]);
    const getTagManagementResponsePromise = waitForApiResponse(page, 'GET', '/api/v1/users/me/tags');
    await exportImportPage.visit();
    await getTagManagementResponsePromise;
  });

  test('exports tag management and imports them while skipping conflicts', async ({ api, page }) => {
    const exportPath = test.info().outputPath('collection-tracker-tag-management.json');
    const downloadPromise = page.waitForEvent('download');
    await exportImportPage.getTagManagementExportButton().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('collection-tracker-tag-management.json');
    await download.saveAs(exportPath);
    const source = await readFile(exportPath, 'utf8');
    expect(JSON.parse(source)).toEqual({
      type: 'collection-tracker-tag-management',
      version: 1,
      tagManagement: [exportedExistingConfig, exportedImportedConfig],
    });

    await api.request('POST', '/api/v1/users/me/tags', [localExistingConfig]);
    const getLocalTagManagementResponsePromise = waitForApiResponse(page, 'GET', '/api/v1/users/me/tags');
    await exportImportPage.visit();
    await getLocalTagManagementResponsePromise;

    const importTagManagementResponsePromise = waitForApiResponse(page, 'POST', '/api/v1/users/me/tags');
    page.on('dialog', async (dialog) => {
      await dialog.dismiss();
    });
    await exportImportPage.getTagManagementImportFileInput().setInputFiles(exportPath);
    await importTagManagementResponsePromise;

    const tagManagementResponse = await api.request('GET', '/api/v1/users/me/tags');
    const tagManagementBody = (await tagManagementResponse.json()) as {
      data: Array<ReturnType<typeof buildTagManagement>>;
    };
    expect(tagManagementBody.data).toContainEqual(localExistingConfig);
    expect(tagManagementBody.data).toContainEqual(exportedImportedConfig);
    expect(tagManagementBody.data).not.toContainEqual(exportedExistingConfig);
  });
});

test.describe('Export/Import — collection data export', () => {
  const seriesImdbId = 'tt8400001';
  const watchedImdbId = 'tt8400002';

  test.beforeEach(async ({ api, autoLogin }) => {
    await autoLogin();
    await api.request('POST', '/api/v1/users/me/tags', []);
    await api.request('POST', '/api/v1/collection-items', buildCollectionItem('Export Movie', 'movie'));
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Export Series', 'series', seriesImdbId),
      listType: 'tracking',
    });
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Export Tracker Movie', 'movie', watchedImdbId),
      listType: 'tracking',
    });
    await api.request('PUT', `/api/v1/collection-items/omdb/${seriesImdbId}/tracking/seasons`, {
      seasons: [{ season: 1, episodes: 2, titles: ['Pilot', 'Second'] }],
    });
    await api.request('PUT', `/api/v1/collection-items/omdb/${seriesImdbId}/tracking/completed-episodes`, {
      completedEpisodes: [{ season: 1, episode: 1 }],
    });
    await exportImportPage.visit();
  });

  test('exports collection data to a JSON file', async ({ page }) => {
    const exportPath = test.info().outputPath('collection-tracker-export.json');
    const getExportResponsePromise = waitForApiResponse(page, 'GET', '/api/v1/users/me/export');
    const downloadPromise = page.waitForEvent('download');
    await exportImportPage.getCollectionDataExportButton().click();
    expect((await getExportResponsePromise).status()).toBe(200);
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('collection-tracker-export.json');
    await download.saveAs(exportPath);

    const source = await readFile(exportPath, 'utf8');
    const parsed = JSON.parse(source);
    expect(parsed.type).toBe('collection-tracker-export');
    expect(parsed.version).toBe(11);
    expect(Array.isArray(parsed.collectionItems)).toBe(true);
    expect(parsed.collectionItems.length).toBeGreaterThan(0);
    expect(Array.isArray(parsed.tagManagement)).toBe(true);
    expect(parsed.trackingData[`omdb/${seriesImdbId}`]).toEqual({
      seasons: [{ season: 1, episodes: 2, titles: ['Pilot', 'Second'] }],
      completedEpisodes: [{ season: 1, episode: 1 }],
    });
    const trackerItem = parsed.collectionItems.find(
      (collectionItem: { IMDbId: string; listType: string }) =>
        collectionItem.IMDbId === watchedImdbId && collectionItem.listType === 'tracking'
    );
    expect(trackerItem).not.toBeUndefined();
    expect(trackerItem.title).toBe('Export Tracker Movie');
    expect(trackerItem.contentType).toBe('movie');
    expect(trackerItem.favorite).toBe(false);
  });

  test('imports collection data from an exported JSON file', async ({ api, page }) => {
    const exportPath = test.info().outputPath('collection-tracker-export.json');
    const getExportResponsePromise = waitForApiResponse(page, 'GET', '/api/v1/users/me/export');
    const downloadPromise = page.waitForEvent('download');
    await exportImportPage.getCollectionDataExportButton().click();
    expect((await getExportResponsePromise).status()).toBe(200);
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('collection-tracker-export.json');
    await download.saveAs(exportPath);
    await readFile(exportPath, 'utf8');

    const createExtraItemResponse = await api.request(
      'POST',
      '/api/v1/collection-items',
      buildCollectionItem('Imported State Should Remove This', 'movie', 'tt8500001')
    );
    expect(createExtraItemResponse.status()).toBe(200);
    await api.request('POST', '/api/v1/users/me/tags', []);
    const importCollectionDataResponsePromise = waitForApiResponse(page, 'POST', '/api/v1/users/me/imports');

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });
    await exportImportPage.getCollectionDataImportFileInput().setInputFiles(exportPath);
    expect((await importCollectionDataResponsePromise).status()).toBe(200);

    const libraryResponse = await api.request('GET', '/api/v1/collection-items?limit=100&listType=library');
    const libraryBody = (await libraryResponse.json()) as {
      data: Array<{ title: string }>;
      page: { limit: number; hasMore: boolean; nextCursor: string | null };
    };
    expect(libraryBody.page).toEqual({ limit: 100, hasMore: false, nextCursor: null });
    const libraryTitles = libraryBody.data.map((collectionItem) => collectionItem.title);
    expect(libraryTitles).toContain('Export Movie');
    expect(libraryTitles).not.toContain('Imported State Should Remove This');

    const completedEpisodesResponse = await api.request(
      'GET',
      `/api/v1/collection-items/omdb/${seriesImdbId}/tracking/completed-episodes`
    );
    const completedEpisodesBody = (await completedEpisodesResponse.json()) as {
      data: { completedEpisodes: Array<{ season: number; episode: number }> };
    };
    expect(completedEpisodesBody.data.completedEpisodes).toEqual([{ season: 1, episode: 1 }]);

    const trackingResponse = await api.request('GET', '/api/v1/collection-items?limit=100&listType=tracking');
    const trackingBody = (await trackingResponse.json()) as {
      data: Array<{ title: string }>;
      page: { limit: number; hasMore: boolean; nextCursor: string | null };
    };
    expect(trackingBody.page).toEqual({ limit: 100, hasMore: false, nextCursor: null });
    const trackingTitles = trackingBody.data.map((collectionItem) => collectionItem.title);
    expect(trackingTitles).toContain('Export Tracker Movie');
  });

  test('rejects obsolete collection data without changing the collection', async ({ api, page }) => {
    let libraryItemsBeforeImport: unknown[] = [];
    const exportPath = test.info().outputPath('collection-tracker-export.json');
    const getExportResponsePromise = waitForApiResponse(page, 'GET', '/api/v1/users/me/export');
    const downloadPromise = page.waitForEvent('download');
    await exportImportPage.getCollectionDataExportButton().click();
    expect((await getExportResponsePromise).status()).toBe(200);
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('collection-tracker-export.json');
    await download.saveAs(exportPath);
    const source = await readFile(exportPath, 'utf8');
    const exportData = JSON.parse(source);
    await writeFile(exportPath, JSON.stringify({ ...exportData, version: 10 }), 'utf8');

    const createPreservedItemResponse = await api.request(
      'POST',
      '/api/v1/collection-items',
      buildCollectionItem('Rejected Import Must Preserve This', 'movie', 'tt8500002')
    );
    expect(createPreservedItemResponse.status()).toBe(200);
    const libraryBeforeImportResponse = await api.request('GET', '/api/v1/collection-items?limit=100&listType=library');
    const libraryBeforeImportBody = (await libraryBeforeImportResponse.json()) as { data: unknown[] };
    libraryItemsBeforeImport = libraryBeforeImportBody.data;
    const importCollectionDataResponsePromise = waitForApiResponse(page, 'POST', '/api/v1/users/me/imports');

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });
    await exportImportPage.getCollectionDataImportFileInput().setInputFiles(exportPath);
    expect((await importCollectionDataResponsePromise).status()).toBe(400);

    await expect(exportImportPage.getToastMessage()).toContainText([
      'Could not import the collection data. Please select a valid collection tracker export file.',
    ]);
    const libraryAfterImportResponse = await api.request('GET', '/api/v1/collection-items?limit=100&listType=library');
    const libraryAfterImportBody = (await libraryAfterImportResponse.json()) as { data: unknown[] };
    expect(libraryAfterImportBody.data).toEqual(libraryItemsBeforeImport);
  });

  test('sends selected IMDb ID file content for collection-item import', async ({ api, page }) => {
    const imdbSource = '- https://www.imdb.com/title/tt8600001/\n- tt8600002';
    const importPath = test.info().outputPath('imdb-import.md');
    await writeFile(importPath, imdbSource, 'utf8');
    for (const imdbId of ['tt8600001', 'tt8600002']) {
      const response = await api.request(
        'POST',
        '/api/v1/collection-items',
        buildCollectionItem(`IMDb Import ${imdbId}`, 'movie', imdbId)
      );
      expect(response.status()).toBe(200);
    }

    const importCollectionItemsResponsePromise = waitForApiResponse(page, 'POST', '/api/v1/collection-items/imports');
    await exportImportPage.getCollectionItemsImdbIdImportFileInput().setInputFiles(importPath);
    const importCollectionItemsResponse = await importCollectionItemsResponsePromise;
    expect(importCollectionItemsResponse.request().postDataJSON()).toEqual({ source: imdbSource });
    expect(importCollectionItemsResponse.status()).toBe(200);
    expect(await importCollectionItemsResponse.json()).toEqual({
      data: { totalCount: 2, importedCount: 0, skippedCount: 2, errorCount: 0 },
    });
  });
});
