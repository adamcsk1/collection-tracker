import type { Page } from '@playwright/test';
import { buildBooksItem, buildOpenLibraryItem, buildOpenLibrarySearchResult } from '../fixtures/openlibrary';
import { createBooksPage } from '../page-objects/books.po';
import { createCollectionPage } from '../page-objects/collection.po';
import { createCommonPage } from '../page-objects/common.po';
import { createSettingsPage } from '../page-objects/settings.po';
import { expect, test } from '../support/test';

let booksPage: ReturnType<typeof createBooksPage>;
let collectionPage: ReturnType<typeof createCollectionPage>;
let commonPage: ReturnType<typeof createCommonPage>;
let settingsPage: ReturnType<typeof createSettingsPage>;

test.beforeEach(async ({ page }) => {
  booksPage = createBooksPage(page);
  collectionPage = createCollectionPage(page);
  commonPage = createCommonPage(page);
  settingsPage = createSettingsPage(page);
});

const waitForApiResponse = (page: Page, method: string, urlPart: string) =>
  page.waitForResponse((response) => response.request().method() === method && response.url().includes(urlPart));

test.describe('Books', () => {
  test.beforeEach(async ({ autoLogin }) => {
    await autoLogin();
  });

  test('toggles books filter while keeping the direct route accessible', async ({ page }) => {
    await collectionPage.visit();
    await page.getByTestId('show-functions').click();
    await expect(collectionPage.getMediaChip('book')).toBeVisible();

    await settingsPage.visitFeatures();
    let saveSettingsResponsePromise = waitForApiResponse(page, 'POST', '/api/v1/users/me/settings');
    await settingsPage.getFeatureBooksCheckbox().setChecked(false);
    expect((await saveSettingsResponsePromise).status()).toBe(200);

    await collectionPage.visit();
    await expect(collectionPage.getMediaChip('book')).toHaveCount(0);
    await commonPage.openMenu();
    await expect(commonPage.getMenuNavItem('nav-books')).toHaveCount(0);
    await commonPage.closeMenu();

    await booksPage.visit();
    await expect(page).toHaveURL(/#\/collection\/books/);
    await expect(booksPage.getEmptyState()).toBeVisible();

    await settingsPage.visitFeatures();
    saveSettingsResponsePromise = waitForApiResponse(page, 'POST', '/api/v1/users/me/settings');
    await settingsPage.getFeatureBooksCheckbox().setChecked(true);
    expect((await saveSettingsResponsePromise).status()).toBe(200);
    await collectionPage.visit();
    await expect(collectionPage.getMediaChip('book')).toBeVisible();
  });

  test('searches Open Library, creates a book, shows its details, and deletes it', async ({ page }) => {
    const title = 'The E2E Book';
    const isbn = '9780306406157';
    await page.route('**/api/v1/external-metadata/search*provider=openlibrary*', async (route) => {
      await route.fulfill({ status: 200, json: { data: buildOpenLibrarySearchResult(title, isbn) } });
    });
    await page.route('**/api/v1/external-metadata/items*externalIdentitySource=openlibrary*', async (route) => {
      await route.fulfill({ status: 200, json: { data: buildOpenLibraryItem(title, isbn) } });
    });

    await booksPage.visit();
    await booksPage.getAddFirstItemLink().click();
    const openLibrarySearchResponsePromise = waitForApiResponse(page, 'GET', '/api/v1/external-metadata/search');
    await booksPage.getNewItemSearchInput().fill(title);
    await openLibrarySearchResponsePromise;
    await expect(booksPage.getNewItemContentOptions()).toHaveCount(1);
    await expect(booksPage.getNewItemContentOptions()).toContainText([title]);

    const openLibraryItemResponsePromise = waitForApiResponse(page, 'GET', '/api/v1/external-metadata/items');
    const createBookResponsePromise = waitForApiResponse(page, 'POST', '/api/v1/collection-items');
    await booksPage.getNewItemSaveAndCloseButton().click();
    await openLibraryItemResponsePromise;
    const createBookResponse = await createBookResponsePromise;
    expect(createBookResponse.request().postDataJSON()).toMatchObject({
      title,
      contentType: 'book',
      externalProvider: 'openlibrary',
      externalItemId: isbn,
      listType: 'books',
      actors: 'Author One, Author Two',
    });
    expect(createBookResponse.request().postDataJSON().externalIds).toEqual([{ source: 'isbn', id: isbn }]);
    expect(createBookResponse.status()).toBe(200);

    await expect(booksPage.getListItemTitles()).toHaveCount(1);
    await expect(booksPage.getListItemTitles()).toContainText([title]);
    await booksPage.getListItemImages().first().click();
    await expect(booksPage.getItemDialog()).toContainText(title);
    await expect(booksPage.getItemDialog()).toContainText('Author One, Author Two');
    await expect(booksPage.getItemDialogIsbn()).toContainText(isbn);

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });
    const deleteBookResponsePromise = waitForApiResponse(page, 'DELETE', '/api/v1/collection-items/');
    await booksPage.getItemDialogDeleteButton().click();
    expect((await deleteBookResponsePromise).status()).toBe(204);
    await expect(booksPage.getEmptyState()).toBeVisible();
  });

  test('adds a books list item manually by ISBN and persists it after reload', async ({ page }) => {
    const title = 'Manual E2E Book';
    const isbn = '9780140328721';
    const authors = 'Manual Author';

    await booksPage.visit();
    await booksPage.getShowFunctionsButton().click();
    await booksPage.getAddNewButton().click();

    await booksPage.getNewItemManualModeButton().click();
    await booksPage.getNewItemManualTitleInput().fill(title);
    await booksPage.getNewItemManualIsbnInput().fill(isbn);
    await booksPage.getNewItemManualAuthorsInput().fill(authors);
    await expect(booksPage.getNewItemSaveAndCloseButton()).toBeEnabled();
    const createManualBookResponsePromise = waitForApiResponse(page, 'POST', '/api/v1/collection-items');
    await booksPage.getNewItemSaveAndCloseButton().click();

    const createManualBookResponse = await createManualBookResponsePromise;
    expect(createManualBookResponse.request().postDataJSON()).toMatchObject({
      title,
      contentType: 'book',
      externalProvider: 'openlibrary',
      externalItemId: isbn,
      listType: 'books',
      actors: authors,
      favorite: false,
    });
    expect(createManualBookResponse.request().postDataJSON().externalIds).toEqual([{ source: 'isbn', id: isbn }]);
    expect(createManualBookResponse.status()).toBe(200);

    await expect(booksPage.getListItemTitles()).toHaveCount(1);
    await expect(booksPage.getListItemTitles()).toContainText([title]);
    await booksPage.getListItemImages().first().click();
    await expect(booksPage.getItemDialog()).toContainText(title);
    await expect(booksPage.getItemDialog()).toContainText(authors);
    await expect(booksPage.getItemDialogIsbn()).toContainText(isbn);

    const reloadBooksResponsePromise = waitForApiResponse(page, 'GET', '/api/v1/collection-items');
    await page.reload();
    await reloadBooksResponsePromise;
    await expect(booksPage.getListItemTitles()).toHaveCount(1);
    await expect(booksPage.getListItemTitles()).toContainText([title]);
  });

  test('keeps manual book save disabled for invalid ISBN or missing required fields', async () => {
    await booksPage.visit();
    await booksPage.getShowFunctionsButton().click();
    await booksPage.getAddNewButton().click();

    await booksPage.getNewItemManualModeButton().click();
    await booksPage.getNewItemManualTitleInput().fill('Manual Book Title');
    await expect(booksPage.getNewItemSaveAndCloseButton()).toBeDisabled();

    await booksPage.getNewItemManualIsbnInput().fill('not-an-isbn');
    await expect(booksPage.getNewItemSaveAndCloseButton()).toBeDisabled();

    await booksPage.getNewItemManualIsbnInput().fill('9780140328721');
    await expect(booksPage.getNewItemSaveAndCloseButton()).toBeEnabled();
  });

  test('clears all books list data from manage tracker data settings', async ({ api, page }) => {
    const createBookResponse = await api.request('POST', '/api/v1/collection-items', buildBooksItem('Book To Clear'));
    expect(createBookResponse.status()).toBe(200);
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await settingsPage.visitManageTrackerData();
    const clearBooksResponsePromise = waitForApiResponse(page, 'DELETE', '/api/v1/collection-items/books');
    await settingsPage.getRemoveAllTrackedBookDataButton().click();
    expect((await clearBooksResponsePromise).status()).toBe(200);

    await booksPage.visit();
    await expect(booksPage.getEmptyState()).toBeVisible();
  });
});
