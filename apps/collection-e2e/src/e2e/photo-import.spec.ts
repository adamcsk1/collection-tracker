import type { Page } from '@playwright/test';
import sharp from 'sharp';
import { buildOmdbItem } from '../fixtures/omdb';
import { buildOpenLibraryItem } from '../fixtures/openlibrary';
import { buildMusicBrainzItem } from '../fixtures/musicbrainz';
import { createBooksPage } from '../page-objects/books.po';
import { createMusicPage } from '../page-objects/music.po';
import { createCollectionPage } from '../page-objects/collection.po';
import { createMessageDialog } from '../page-objects/message-dialog.po';
import { createPhotoImportDialog } from '../page-objects/photo-import.po';
import type { CollectionPageResponse } from '../support/api-model';
import { expect, test } from '../support/test';

const movies = [
  { ...buildOmdbItem('Photo Alpha', 'tt9100001'), poster: '', externalIds: [{ source: 'imdb', id: 'tt9100001' }] },
  { ...buildOmdbItem('Photo Beta', 'tt9100002'), poster: '', externalIds: [{ source: 'imdb', id: 'tt9100002' }] },
  { ...buildOmdbItem('Photo Gamma', 'tt9100003'), poster: '', externalIds: [{ source: 'imdb', id: 'tt9100003' }] },
];
const wrongType = { ...buildOmdbItem('Wrong media type', 'tt9100004', 'series'), poster: '' };
const ownedIds = [...movies.map((movie) => movie.providerItemId), 'tt9100005'];
// Sharp-generated JPEG; no camera data or personal photos leave the test.
let jpeg: Buffer;
test.beforeAll(async () => {
  jpeg = await sharp({ create: { width: 32, height: 48, channels: 3, background: '#587340' } })
    .jpeg()
    .toBuffer();
});
const photo = (name: string) => ({ name, mimeType: 'image/jpeg', buffer: jpeg });
const recognized = (...titles: string[]) => ({
  data: { titles: titles.map((title) => ({ title, year: null, contributor: null })) },
});
const waitForApiResponse = (page: Page, method: string, pathname: string) =>
  page.waitForResponse(
    (response) => response.request().method() === method && new URL(response.url()).pathname === pathname
  );

test.describe('Photo import', () => {
  test.beforeEach(async ({ page, autoLoginWithNewUser }) => {
    await page.route('**/api/v1/ai/availability', (route) => route.fulfill({ json: { data: { aiAvailable: false } } }));
    await page.route('**/api/v1/ai/vision/availability', (route) =>
      route.fulfill({ json: { data: { available: true, reason: 'available' } } })
    );
    await page.route('**/api/v1/external-metadata/search*', (route) => {
      const query = new URL(route.request().url()).searchParams.get('s');
      const match = movies.find((movie) => movie.title === query);
      return route.fulfill({ json: { data: { results: match ? [match, wrongType] : [] } } });
    });
    await page.route('**/api/v1/external-metadata/items*', (route) => {
      const identity = new URL(route.request().url()).searchParams.get('externalIdentityId');
      const match = movies.find((movie) => movie.providerItemId === identity);
      if (!match) throw new Error(`Unexpected metadata identity: ${identity}`);
      return route.fulfill({ json: { data: match } });
    });
    await autoLoginWithNewUser();
  });

  test.afterEach(async ({ api }) => {
    const response = await api.request('GET', '/api/v1/collection-items?listType=library&limit=100');
    const collection = (await response.json()) as CollectionPageResponse;
    for (const item of collection.data.filter((item) => ownedIds.includes(item.externalItemId))) {
      const query = new URLSearchParams({ hash: item.hash, listType: 'library' });
      const deleted = await api.request(
        'DELETE',
        `/api/v1/collection-items/${encodeURIComponent(item.externalProvider)}/${encodeURIComponent(item.externalItemId)}?${query}`
      );
      expect(deleted.status()).toBe(204);
    }
  });

  test('reviews multiple photos, explicitly selects fixed-type matches, and never resubmits terminal rows', async ({
    page,
    api,
  }, testInfo) => {
    const collection = createCollectionPage(page);
    const dialog = createPhotoImportDialog(page);
    const recognizedRequests: unknown[] = [];
    await page.route('**/api/v1/ai/vision/recognize', (route) => {
      recognizedRequests.push(route.request().postDataJSON());
      return route.fulfill({
        json: recognizedRequests.length === 1 ? recognized('Photo Alpha', 'Photo Beta') : recognized('Photo Gamma'),
      });
    });
    const createdIds: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/collection-items') {
        createdIds.push(request.postDataJSON().externalItemId);
      }
    });
    await collection.openNewItemDialog();
    await expect(dialog.getFromPhotosButton()).toBeEnabled();
    await expect(dialog.getAvailabilityStatus()).toHaveCount(0);
    await collection.getNewItemContentSelect().selectOption('movie');
    await expect(dialog.getFromPhotosButton()).toBeEnabled();
    await expect(dialog.getAvailabilityStatus()).toHaveCount(0);
    await dialog.open();
    await expect(dialog.getFromPhotosButton()).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('dialog-frame')).toHaveCount(1);
    await expect(dialog.getContext()).toContainText('Movies');
    await expect(dialog.getPrivacy()).toContainText('does not store photos');
    await expect(dialog.getChooseButton()).toBeVisible();
    await expect(dialog.getFooter()).toHaveCSS('justify-content', /^(flex|flow)-end$/);
    await expect(dialog.getAddButton()).toHaveCount(0);
    await expect(dialog.getReadButton()).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('photo-import-selection-desktop.png'), animations: 'disabled' });
    await dialog.uploadPhotos([photo('first.jpg'), photo('second.jpg')]);
    await dialog.readPhotos();
    await expect(dialog.getProgress()).toHaveText('2 of 2 photos read');
    await expect(dialog.getRows()).toHaveCount(3);
    for (const index of [0, 1, 2]) {
      await expect(dialog.getMatchButtons(index)).toHaveCount(1);
      await expect(dialog.getMatchButtons(index)).toHaveAttribute('aria-pressed', 'false');
    }
    await expect(dialog.getAddButton()).toBeDisabled();
    expect(recognizedRequests).toEqual([
      { contentType: 'movie', imageBase64: jpeg.toString('base64') },
      { contentType: 'movie', imageBase64: jpeg.toString('base64') },
    ]);
    await dialog.selectMatch(0);
    await dialog.selectMatch(1);
    await dialog.toggleSkip(2);
    await expect(dialog.getStatus(2)).toHaveText('Photo Gamma: Skipped');
    const firstCreate = waitForApiResponse(page, 'POST', '/api/v1/collection-items');
    await dialog.addSelected();
    expect((await firstCreate).status()).toBe(200);
    await expect(dialog.getStatus(0)).toHaveText('Photo Alpha: Added');
    await expect(dialog.getStatus(1)).toHaveText('Photo Beta: Added');
    await expect(dialog.getAddButton()).toBeDisabled();
    await dialog.toggleSkip(2);
    await dialog.selectMatch(2);
    const nextCreate = waitForApiResponse(page, 'POST', '/api/v1/collection-items');
    await dialog.addSelected();
    expect((await nextCreate).status()).toBe(200);
    await expect(dialog.getStatus(2)).toHaveText('Photo Gamma: Added');
    expect(createdIds).toEqual(ownedIds.slice(0, 3));
    const saved = await api.request('GET', '/api/v1/collection-items?listType=library&limit=100');
    const savedBody = await saved.json();
    expect(savedBody.data).toHaveLength(3);
    for (const movie of movies) {
      expect(savedBody.data).toContainEqual(
        expect.objectContaining({
          title: movie.title,
          contentType: 'movie',
          listType: 'library',
          externalProvider: 'omdb',
          externalItemId: movie.providerItemId,
          externalIds: expect.arrayContaining([
            ...movie.externalIds,
            { source: movie.provider, id: movie.providerItemId },
          ]),
        })
      );
    }
    await collection.getNewItemSearchModeButton().click();
    await expect(dialog.getDialogHost()).toHaveCount(0);
    await expect(collection.getNewItemSearchInput()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(collection.getListItems()).toHaveCount(3);
  });

  for (const contentType of ['book', 'album'] as const) {
    test(`imports a ${contentType} photo through canonical metadata and detects it after reload`, async ({
      page,
      api,
    }) => {
      const title = contentType === 'book' ? 'Photo ISBN Book' : 'Photo Barcode Album';
      const identifier = contentType === 'book' ? '9780306406157' : '5099902987613';
      const releaseId = 'f509c5ff-ad54-4dde-b61e-24f750965835';
      const metadata =
        contentType === 'book'
          ? { ...buildOpenLibraryItem(title, 'OL123W'), externalIds: [{ source: 'openlibrary', id: 'OL123W' }] }
          : buildMusicBrainzItem(title, `release-group:${releaseId}`);
      const discovered =
        contentType === 'book'
          ? { ...metadata, externalIds: [...metadata.externalIds, { source: 'isbn', id: identifier }] }
          : { ...metadata, externalIds: [...metadata.externalIds, { source: 'musicbrainz', id: releaseId }] };
      const listType = contentType === 'book' ? 'books' : 'music';
      const list = contentType === 'book' ? createBooksPage(page) : createMusicPage(page);
      const dialog = createPhotoImportDialog(page);
      const queries: string[] = [];
      await page.route('**/api/v1/ai/vision/recognize', (route) => {
        expect(route.request().postDataJSON().contentType).toBe(contentType);
        return route.fulfill({ json: { data: { titles: [{ title, identifier, year: null, contributor: null }] } } });
      });
      await page.route('**/api/v1/external-metadata/search*', (route) => {
        const query = new URL(route.request().url()).searchParams.get('s')!;
        queries.push(query);
        return route.fulfill({ json: { data: { results: query === title ? [discovered] : [] } } });
      });
      await page.route('**/api/v1/external-metadata/items*', (route) => {
        const identity = new URL(route.request().url()).searchParams.get('externalIdentityId');
        expect([identifier, metadata.providerItemId]).toContain(identity);
        return route.fulfill({ json: { data: identity === identifier ? discovered : metadata } });
      });
      let creates = 0;
      page.on('request', (request) => {
        if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/collection-items') creates++;
      });

      for (const status of ['Added', 'Already in this collection']) {
        await list.visit();
        await list.getShowFunctionsButton().click();
        await list.getAddNewButton().click();
        await dialog.open();
        await dialog.uploadPhotos([photo(`${contentType}.jpg`)]);
        await dialog.readPhotos();
        await expect(dialog.getMatchButtons(0)).toHaveCount(1);
        await dialog.selectMatch(0);
        await dialog.addSelected();
        await expect(dialog.getStatus(0)).toHaveText(`${title}: ${status}`);
        await page.reload();
        await expect(list.getListItemTitles()).toHaveText([title]);
      }
      expect(creates).toBe(1);
      expect(queries).toEqual(contentType === 'album' ? [identifier, title, identifier, title] : []);
      const saved = await api.request('GET', `/api/v1/collection-items?listType=${listType}&limit=100`);
      expect(saved.status()).toBe(200);
      expect((await saved.json()).data).toEqual([
        expect.objectContaining({
          title,
          contentType,
          listType,
          externalProvider: metadata.provider,
          externalItemId: metadata.providerItemId,
          externalIds: expect.arrayContaining(discovered.externalIds),
        }),
      ]);
    });
  }

  test('retries only failed photos and searches corrected row queries without duplicate selections', async ({
    page,
  }) => {
    const collection = createCollectionPage(page);
    const dialog = createPhotoImportDialog(page);
    let recognitionCalls = 0;
    await page.route('**/api/v1/ai/vision/recognize', (route) => {
      recognitionCalls += 1;
      if (recognitionCalls === 2) {
        return route.fulfill({
          status: 503,
          contentType: 'application/problem+json',
          json: { type: 'about:blank', title: 'Vision unavailable', status: 503 },
        });
      }
      return route.fulfill({ json: recognized(recognitionCalls === 1 ? 'Photo Alpha' : 'Misread title') });
    });
    await collection.openNewItemDialog();
    await dialog.open();
    await dialog.uploadPhotos([photo('success.jpg'), photo('retry.jpg')]);
    await dialog.readPhotos();
    await expect(dialog.getReadButton()).toBeVisible();
    await expect(dialog.getRows()).toHaveCount(1);
    await expect(dialog.getPhotos().nth(1)).toContainText('Could not read this photo');
    await dialog.readPhotos();
    await expect(dialog.getRows()).toHaveCount(2);
    await expect(dialog.getProgress()).toHaveText('2 of 2 photos read');
    expect(recognitionCalls).toBe(3);
    await dialog.selectMatch(0);
    const correctedSearch = waitForApiResponse(page, 'GET', '/api/v1/external-metadata/search');
    await dialog.searchRow(1, 'Photo Alpha');
    const response = await correctedSearch;
    expect(new URL(response.url()).searchParams.get('s')).toBe('Photo Alpha');
    await expect(dialog.getSearchInput(1)).toHaveValue('Photo Alpha');
    await expect(dialog.getRow(1).getByTestId('photo-import-search-button')).toHaveCount(0);
    await expect(dialog.getMatchButtons(1)).toBeDisabled();
    await dialog.toggleSkip(0);
    await expect(dialog.getMatchButtons(1)).toBeEnabled();
    await dialog.selectMatch(1);
    await expect(dialog.getMatchButtons(1)).toHaveAttribute('aria-pressed', 'true');
    await dialog.toggleSkip(0);
    await expect(dialog.getMatchButtons(0)).toHaveAttribute('aria-pressed', 'false');
    await expect(dialog.getMatchButtons(0)).toBeDisabled();
  });

  test('automatically searches edits and offers same-query retry only after a provider failure', async ({ page }) => {
    await page.route('**/api/v1/ai/vision/recognize', (route) => route.fulfill({ json: recognized('Photo Alpha') }));
    let attempts = 0;
    await page.route('**/api/v1/external-metadata/search*', (route) => {
      attempts++;
      if (attempts === 2) {
        return route.fulfill({
          status: 503,
          contentType: 'application/problem+json',
          json: { type: 'about:blank', title: 'Metadata unavailable', status: 503 },
        });
      }
      return route.fulfill({ json: { data: { results: [attempts === 1 ? movies[0] : movies[1]] } } });
    });
    const collection = createCollectionPage(page);
    const dialog = createPhotoImportDialog(page);
    await collection.openNewItemDialog();
    await dialog.open();
    await dialog.uploadPhotos([photo('edit.jpg')]);
    await dialog.readPhotos();
    await expect(dialog.getMatchButtons(0)).toHaveCount(1);
    await dialog.selectMatch(0);
    await expect(dialog.getRetrySearchButton(0)).toHaveCount(0);
    const failedSearch = waitForApiResponse(page, 'GET', '/api/v1/external-metadata/search');
    await dialog.searchRow(0, 'Photo Beta');
    await expect(dialog.getAddButton()).toBeDisabled();
    expect((await failedSearch).status()).toBe(503);
    await expect(dialog.getRetrySearchButton(0)).toBeVisible();
    await expect(dialog.getMatchButtons(0)).toHaveCount(0);
    const retry = waitForApiResponse(page, 'GET', '/api/v1/external-metadata/search');
    await dialog.getRetrySearchButton(0).click();
    expect((await retry).status()).toBe(200);
    await expect(dialog.getRetrySearchButton(0)).toHaveCount(0);
    await expect(dialog.getMatchButtons(0)).toHaveCount(1);
    await expect(dialog.getMatchButtons(0)).toHaveAttribute('aria-pressed', 'false');
    expect(attempts).toBe(3);
  });

  test('keeps manual creation available when vision is not configured', async ({ page, api }) => {
    await page.route('**/api/v1/ai/vision/availability', (route) =>
      route.fulfill({ json: { data: { available: false, reason: 'not-configured' } } })
    );
    const collection = createCollectionPage(page);
    const dialog = createPhotoImportDialog(page);
    await collection.openNewItemDialog();
    await expect(dialog.getFromPhotosButton()).toBeEnabled();
    await dialog.open();
    await expect(dialog.getChooseButton()).toBeDisabled();
    await expect(dialog.getAvailabilityStatus()).toContainText('ollama-vision.config.json');
    await collection.getNewItemManualModeButton().click();
    await collection.getNewItemManualTitleInput().fill('Manual without vision');
    await collection.getNewItemManualImdbIdInput().fill('tt9100005');
    const created = waitForApiResponse(page, 'POST', '/api/v1/collection-items');
    await collection.getNewItemSaveAndCloseButton().click();
    expect((await created).status()).toBe(200);
    const response = await api.request('GET', '/api/v1/collection-items?listType=library&limit=100');
    expect((await response.json()).data).toContainEqual(
      expect.objectContaining({ title: 'Manual without vision', externalItemId: 'tt9100005' })
    );
    await expect(collection.getListItemByTitle('Manual without vision')).toBeVisible();
  });

  test('preserves normal drafts and restores the active tab after cancelling photo discard', async ({ page }) => {
    const collection = createCollectionPage(page);
    const dialog = createPhotoImportDialog(page);
    const message = createMessageDialog(page);
    await collection.openNewItemDialog();
    await collection.getNewItemSearchInput().fill('Parent draft');
    await dialog.getFromPhotosButton().press('Enter');
    await dialog.uploadPhotos([photo('draft.jpg')]);
    await collection.getNewItemSearchModeButton().press('Enter');
    await expect(message.getDialog()).toBeVisible();
    await expect(dialog.getDialogHost()).toBeAttached();
    await expect(collection.getNewItemSearchInput()).toHaveValue('Parent draft');
    await message.cancel();
    await expect(dialog.getFromPhotosButton()).toBeFocused();
    await expect(dialog.getPhotos()).toHaveCount(1);
    await collection.getNewItemSearchModeButton().press('Enter');
    await message.confirm();
    await expect(dialog.getDialogHost()).toHaveCount(0);
    await expect(collection.getNewItemSearchModeButton()).toBeFocused();
    await expect(collection.getNewItemSearchInput()).toHaveValue('Parent draft');
  });

  test('fits review controls and actions within a 390px viewport', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/api/v1/ai/vision/recognize', (route) =>
      route.fulfill({ json: recognized('Photo Alpha', 'Photo Beta') })
    );
    const collection = createCollectionPage(page);
    const dialog = createPhotoImportDialog(page);
    await collection.openNewItemDialog();
    await dialog.open();
    await expect(dialog.getChooseButton()).toBeVisible();
    const initialBounds = await dialog.getDialog().boundingBox();
    expect(initialBounds!.height).toBeLessThan(844 * 0.9);
    await page.screenshot({ path: testInfo.outputPath('photo-import-selection-mobile.png'), animations: 'disabled' });
    await dialog.uploadPhotos([photo('mobile.jpg')]);
    await expect(dialog.getFooter()).toHaveCSS('justify-content', /^(flex|flow)-end$/);
    await page.screenshot({ path: testInfo.outputPath('photo-import-pending-mobile.png'), animations: 'disabled' });
    await dialog.readPhotos();
    await expect(dialog.getRows()).toHaveCount(2);
    await dialog.selectMatch(0);
    await expect(dialog.getAddButton()).toBeEnabled();
    for (const control of [dialog.getDialog(), dialog.getSearchInput(0), dialog.getFooter(), dialog.getAddButton()]) {
      const bounds = await control.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    }
    expect(await dialog.getDialog().evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('photo-import-mobile.png'), animations: 'disabled' });
  });
});
