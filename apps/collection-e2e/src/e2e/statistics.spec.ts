import { buildCollectionItem } from '../fixtures/collection-item';
import { buildBooksItem } from '../fixtures/openlibrary';
import { createCollectionPage } from '../page-objects/collection.po';
import { createStatisticsPage } from '../page-objects/statistics.po';
import { createShareHelpers, grant } from '../support/share-helpers';
import { expect, test } from '../support/test';

test('shows empty personal activity and switches to empty collection', async ({ page, autoLoginWithNewUser }) => {
  await autoLoginWithNewUser();
  const statistics = createStatisticsPage(page);
  await statistics.visit();
  await expect(statistics.activityCard('completed')).toContainText('0');
  await expect(statistics.getEmptyMessage()).toBeVisible();
  await expect(statistics.yearView()).toHaveAttribute('aria-selected', 'true');
  await statistics.yearView().focus();
  await page.keyboard.press('ArrowRight');
  await expect(statistics.collectionView()).toBeFocused();
  await expect(statistics.collectionView()).toHaveAttribute('aria-selected', 'true');
  await expect(statistics.getEmptyMessage()).toBeVisible();
});

test('filters plans by year and media, opens details, and retains focus and filters', async ({
  page,
  api,
  autoLoginWithNewUser,
}) => {
  await autoLoginWithNewUser();
  const year = new Date().getFullYear();
  await api.request('POST', '/api/v1/collection-items', {
    ...buildCollectionItem('Planned Movie', 'movie', 'tt9000001'),
    plannedYear: year,
  });
  await api.request('POST', '/api/v1/collection-items', {
    ...buildBooksItem('Last Year Book', '9780306406157'),
    plannedYear: year - 1,
  });
  const statistics = createStatisticsPage(page);
  const collection = createCollectionPage(page);
  await statistics.visit();
  await statistics.activityCard('planned').click();
  await expect(statistics.items()).toHaveCount(1);
  await expect(statistics.items().first()).toContainText('Planned Movie');
  await statistics.items().first().focus();
  await page.keyboard.press('Enter');
  await expect(collection.getItemDialogHost()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(collection.getItemDialogShellHost()).toHaveCount(0);
  await expect(statistics.items().first()).toBeFocused();
  await expect(statistics.activityCard('planned')).toHaveAttribute('aria-pressed', 'true');
  await statistics.lastYear().click();
  await expect(statistics.items()).toHaveCount(1);
  await expect(statistics.items().first()).toContainText('Last Year Book');
  await statistics.selectScope('movie');
  await expect(statistics.items()).toHaveCount(0);
  await expect(statistics.getEmptyMessage()).toBeVisible();
});

test('drills into completed months and edits planned year using the normal dialog', async ({
  page,
  api,
  autoLoginWithNewUser,
}) => {
  await autoLoginWithNewUser();
  const year = new Date().getFullYear();
  await api.request('POST', '/api/v1/collection-items', {
    ...buildCollectionItem('Completed Movie', 'movie', 'tt9000001'),
    listType: 'tracking',
  });
  const statistics = createStatisticsPage(page);
  const collection = createCollectionPage(page);
  await statistics.visit();
  await expect(statistics.activityCard('completed')).toContainText('1');
  await statistics.openMonths();
  await statistics.month(new Date().getMonth() + 1).click();
  await expect(statistics.items()).toHaveCount(1);
  await expect(statistics.allMonths()).toBeVisible();
  await statistics.items().first().click();
  await collection.openItemActions();
  await collection.getItemDialogEditButton().click();
  await collection.getItemDialogPlannedYearInput().fill(`${year + 1}`);
  const saved = page.waitForResponse(
    (response) => response.request().method() === 'PUT' && response.url().includes('/collection-items/')
  );
  await collection.getItemDialogSaveButton().click();
  expect((await saved).status()).toBe(200);
  await expect(collection.getItemDialogSaveButton()).toHaveCount(0);
  await page.keyboard.press('Escape');
  await statistics.activityCard('planned').click();
  await statistics.yearInput().fill(`${year + 1}`);
  await expect(statistics.items()).toHaveCount(1);
  await expect(statistics.items().first()).toContainText('Completed Movie');
});

test('refreshes changed details, retains loaded pages and filters, and restores focus when a title leaves the filter', async ({
  page,
  api,
  autoLoginWithNewUser,
}) => {
  await autoLoginWithNewUser();
  const year = new Date().getFullYear();
  for (let index = 0; index < 51; index++) {
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem(`Planned ${String(index).padStart(2, '0')}`, 'movie', `tt${9000000 + index}`),
      plannedYear: year,
    });
  }
  const statistics = createStatisticsPage(page);
  const collection = createCollectionPage(page);
  await statistics.visit();
  await statistics.selectScope('movie');
  await statistics.activityCard('planned').click();
  await expect(statistics.items()).toHaveCount(50);
  await statistics.loadMore().click();
  await expect(statistics.items()).toHaveCount(51);
  const last = statistics.items().last();
  await last.click();
  await expect(collection.getItemDialogHost()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(statistics.items()).toHaveCount(51);
  await expect(last).toBeFocused();
  await expect(statistics.yearInput()).toHaveValue(`${year}`);

  await last.press('Enter');
  await collection.openItemActions();
  await collection.getItemDialogEditButton().click();
  await collection.getItemDialogTitleInput().fill('Planned 50 updated');
  const titleSaved = page.waitForResponse(
    (response) => response.request().method() === 'PUT' && response.url().includes('/collection-items/')
  );
  await collection.getItemDialogSaveButton().click();
  expect((await titleSaved).status()).toBe(200);
  await expect(collection.getItemDialogSaveButton()).toHaveCount(0);
  const refreshed = page.waitForResponse(
    (response) => response.request().method() === 'GET' && response.url().includes('/collection-items/activity')
  );
  await page.keyboard.press('Escape');
  expect((await refreshed).status()).toBe(200);
  await expect(statistics.items()).toHaveCount(51);
  await expect(last).toContainText('Planned 50 updated');
  await expect(last).toBeFocused();

  await last.press('Enter');
  await collection.openItemActions();
  await collection.getItemDialogEditButton().click();
  await collection.getItemDialogPlannedYearInput().fill(`${year + 1}`);
  const planSaved = page.waitForResponse(
    (response) => response.request().method() === 'PUT' && response.url().includes('/collection-items/')
  );
  await collection.getItemDialogSaveButton().click();
  expect((await planSaved).status()).toBe(200);
  await expect(collection.getItemDialogSaveButton()).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(collection.getItemDialogShellHost()).toHaveCount(0);
  await expect(statistics.items()).toHaveCount(50);
  await expect(statistics.items().filter({ hasText: 'Planned 50 updated' })).toHaveCount(0);
  await expect(statistics.itemsHeading()).toBeFocused();
  await expect(statistics.activityCard('planned')).toHaveText(/^50\s*Planned/);
  await expect(statistics.activityCard('planned')).toHaveAttribute('aria-pressed', 'true');
  await expect(statistics.getScopeChip('movie')).toHaveAttribute('aria-pressed', 'true');
  await expect(statistics.yearInput()).toHaveValue(`${year}`);
  await expect(statistics.loadMore()).toHaveCount(0);
});

test('excludes shared titles from personal plans and completions but includes them in collection composition', async ({
  page,
  api,
}) => {
  const sharing = createShareHelpers(page, api);
  try {
    const { owner, sharedUser } = await sharing.setupShare([grant('tracking', 'movie'), grant('library', 'movie')]);
    const year = new Date().getFullYear();
    for (const [user, title, imdbId] of [
      [owner, 'Shared completed plan', 'tt9000011'],
      [sharedUser, 'Own completed plan', 'tt9000012'],
    ] as const) {
      const response = await sharing.requestAs(user, 'POST', '/api/v1/collection-items', {
        ...buildCollectionItem(title, 'movie', imdbId, 'tracking'),
        plannedYear: year,
      });
      expect(response.status()).toBe(200);
      const libraryResponse = await sharing.requestAs(user, 'POST', '/api/v1/collection-items', {
        ...buildCollectionItem(title, 'movie', imdbId, 'library'),
        plannedYear: year,
      });
      expect(libraryResponse.status()).toBe(200);
    }
    await sharing.signInThroughUi(sharedUser);
    const statistics = createStatisticsPage(page);
    await statistics.visit();
    await expect(statistics.activityCard('planned')).toHaveText(/^1\s*Planned/);
    await expect(statistics.activityCard('completed')).toHaveText(/^1\s*Completed/);
    await statistics.activityCard('planned').click();
    await expect(statistics.items()).toHaveCount(1);
    await expect(statistics.items()).toContainText(['Own completed plan']);
    await statistics.activityCard('completed').click();
    await expect(statistics.items()).toHaveCount(1);
    await expect(statistics.items()).toContainText(['Own completed plan']);
    await statistics.collectionView().click();
    await expect(statistics.getSummaryCard('all')).toContainText('2');
    await statistics.getSummaryCard('all').click();
    await expect(statistics.items()).toHaveCount(2);
    await expect(statistics.items()).toContainText(['Own completed plan', 'Shared completed plan']);
  } finally {
    await sharing.cleanupCreatedUsers();
  }
});

test('shows collection composition as labeled bars and opens matching title lists', async ({
  page,
  api,
  autoLoginWithNewUser,
}) => {
  await autoLoginWithNewUser();
  await api.request('POST', '/api/v1/collection-items', {
    ...buildCollectionItem('Tagged Movie', 'movie', 'tt9000001'),
    tags: ['#movie'],
    favorite: true,
  });
  await api.request('POST', '/api/v1/collection-items', buildBooksItem('Book', '9780306406157'));
  const statistics = createStatisticsPage(page);
  await statistics.visit();
  await statistics.collectionView().click();
  await expect(statistics.getSummaryCard('all')).toContainText('2');
  await statistics.getTag('#movie').click();
  await expect(statistics.items()).toHaveCount(1);
  await expect(statistics.items().first()).toContainText('Tagged Movie');
  await statistics.selectScope('book');
  await expect(statistics.getSummaryCard('all')).toContainText('1');
  await statistics.getSummaryCard('all').click();
  await expect(statistics.items().first()).toContainText('Book');
});
