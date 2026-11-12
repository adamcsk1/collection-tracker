import { buildCollectionItem } from '../fixtures/collection-item';
import { createCollectionPage } from '../page-objects/collection.po';
import { createTagManagementPage } from '../page-objects/tag-management.po';
import type { ApiEnvelope, TestUser } from '../support/share-helper-model';
import { createShareHelpers, libraryMovieSeriesGrants } from '../support/share-helpers';
import { expect, test, type ApiClient } from '../support/test';

/**
 * Builds a movie collection item that also carries a custom tag.
 */
const buildItemWithCustomTag = (title: string, customTag: string, imdbId?: string) => {
  const item = buildCollectionItem(title, 'movie', imdbId);
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

let collectionPage: ReturnType<typeof createCollectionPage>;
let tagManagementPage: ReturnType<typeof createTagManagementPage>;
let shareHelpers: ReturnType<typeof createShareHelpers>;

const getTagCounts = async (api: ApiClient, user?: TestUser) => {
  const response = user
    ? await shareHelpers.requestAs(user, 'GET', '/api/v1/collection-items/statistics')
    : await api.request('GET', '/api/v1/collection-items/statistics');
  const body = (await response.json()) as ApiEnvelope<{
    charts: { tagCounts: Array<{ tag: string; count: number }> };
  }>;
  return body.data.charts.tagCounts;
};

test.beforeEach(async ({ page, api }) => {
  collectionPage = createCollectionPage(page);
  tagManagementPage = createTagManagementPage(page);
  shareHelpers = createShareHelpers(page, api);
});

test.afterEach(async () => {
  await shareHelpers.cleanupCreatedUsers();
});

test.describe('Tag Management — no custom tags', () => {
  test.beforeEach(async ({ autoLogin }) => {
    await autoLogin();
    await tagManagementPage.visit();
  });

  test('shows an empty list when the collection has no configurable tags', async () => {
    await expect(tagManagementPage.getList()).toBeAttached();
    await expect(tagManagementPage.getList().locator('ct-tag-management-card')).toHaveCount(0);
  });
});

test.describe('Tag Management — custom tag in collection', () => {
  const customTag = '#action';
  const item = buildItemWithCustomTag('Tag Management Movie', customTag);

  test.beforeEach(async ({ api, autoLogin, page }) => {
    await autoLogin();
    // Wipe any tag management left over from previous specs so each test starts
    // with a clean slate.
    await api.request('POST', '/api/v1/users/me/tags', []);
    await api.request('POST', '/api/v1/collection-items', item);
    const statisticsResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/collection-items/statistics') && response.request().method() === 'GET'
    );
    await tagManagementPage.visit();
    await statisticsResponsePromise;
    await expect(tagManagementPage.getRenameInput(customTag)).toHaveValue(customTag);
  });

  test('shows the custom tag in the management list', async () => {
    await expect(tagManagementPage.getRenameInput(customTag)).toHaveValue(customTag);
  });

  test('shows the color button for the custom tag', async () => {
    await expect(tagManagementPage.getColorButton(customTag)).toBeVisible();
  });

  test('shows the weight input for the custom tag', async () => {
    await expect(tagManagementPage.getWeightInput(customTag)).toBeVisible();
  });

  test('shows the image-border checkbox for the custom tag', async () => {
    await expect(tagManagementPage.getImageBorderCheckbox(customTag)).toHaveCount(1);
  });

  test('shows the text-color checkbox for the custom tag', async () => {
    await expect(tagManagementPage.getTextColorCheckbox(customTag)).toHaveCount(1);
  });

  test('shows the image-badge checkbox for the custom tag', async () => {
    await expect(tagManagementPage.getImageBadgeCheckbox(customTag)).toHaveCount(1);
  });

  test('can set a weight value for the custom tag', async ({ page }) => {
    const saveResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/v1/users/me/tags') && response.request().method() === 'POST'
    );
    await tagManagementPage.getWeightInput(customTag).fill('5');
    await saveResponsePromise;
    await expect(tagManagementPage.getWeightInput(customTag)).toHaveValue('5');
  });

  test('can check the image-border checkbox', async ({ page }) => {
    const saveResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/v1/users/me/tags') && response.request().method() === 'POST'
    );
    await expect(tagManagementPage.getImageBorderCheckbox(customTag)).not.toBeChecked();
    await tagManagementPage.getImageBorderCheckbox(customTag).check();
    await saveResponsePromise;
    await expect(tagManagementPage.getImageBorderCheckbox(customTag)).toBeChecked();
  });

  test('can check the text-color checkbox', async ({ page }) => {
    const saveResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/v1/users/me/tags') && response.request().method() === 'POST'
    );
    await expect(tagManagementPage.getTextColorCheckbox(customTag)).not.toBeChecked();
    await tagManagementPage.getTextColorCheckbox(customTag).check();
    await saveResponsePromise;
    await expect(tagManagementPage.getTextColorCheckbox(customTag)).toBeChecked();
  });

  test('can check the image-badge checkbox', async ({ page }) => {
    const saveResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/v1/users/me/tags') && response.request().method() === 'POST'
    );
    await expect(tagManagementPage.getImageBadgeCheckbox(customTag)).not.toBeChecked();
    await tagManagementPage.getImageBadgeCheckbox(customTag).check();
    await saveResponsePromise;
    await expect(tagManagementPage.getImageBadgeCheckbox(customTag)).toBeChecked();
  });
});

test.describe('Tag Management — reset', () => {
  const customTag = '#drama';
  const item = buildItemWithCustomTag('Reset Tag Management Movie', customTag);

  test.beforeEach(async ({ api, autoLogin }) => {
    await autoLogin();
    await api.request('POST', '/api/v1/collection-items', item);
    await tagManagementPage.visit();
  });

  test('clears tag management after confirming reset', async ({ page }) => {
    const saveResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/v1/users/me/tags') && response.request().method() === 'POST'
    );
    // Set the checkbox via UI — avoids a race condition where the component's init
    // effect can clear API-seeded entries if it runs before preloadUserTagManagement resolves.
    await tagManagementPage.getImageBorderCheckbox(customTag).check();
    await saveResponsePromise;
    await expect(tagManagementPage.getImageBorderCheckbox(customTag)).toBeChecked();

    const resetResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/v1/users/me/tags') && response.request().method() === 'POST'
    );
    page.on('dialog', (dialog) => dialog.accept());
    await tagManagementPage.getResetButton().click();
    await resetResponsePromise;

    await expect(tagManagementPage.getImageBorderCheckbox(customTag)).not.toBeChecked();
  });
});

test.describe('Tag Management — rename', () => {
  test.beforeEach(async ({ api, autoLogin }) => {
    await autoLogin();
    await api.request('POST', '/api/v1/users/me/tags', []);
  });

  test('renames a custom tag everywhere for the current user', async ({ api, page }) => {
    const oldTag = '#rename-old';
    const newTag = '#rename-new';
    await api.request(
      'POST',
      '/api/v1/collection-items',
      buildItemWithCustomTag('Rename Tag Movie', oldTag, 'tt9910001')
    );
    const statisticsResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/collection-items/statistics') && response.request().method() === 'GET'
    );
    const renameResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/v1/users/me/tags/rename') && response.request().method() === 'POST'
    );
    await tagManagementPage.visit();
    await statisticsResponsePromise;

    page.on('dialog', (dialog) => dialog.accept());
    await tagManagementPage.getRenameInput(oldTag).fill(newTag);
    await tagManagementPage.getRenameButton(oldTag).click();
    await renameResponsePromise;

    await expect(tagManagementPage.getRenameInput(newTag)).toHaveValue(newTag);
    await expect(tagManagementPage.findRenameInputHost(oldTag)).toHaveCount(0);
    expect(await getTagCounts(api)).toContainEqual({ tag: newTag, count: 1 });
  });

  test('merges into an existing custom tag', async ({ api, page }) => {
    const oldTag = '#merge-old';
    const newTag = '#merge-new';
    await api.request(
      'POST',
      '/api/v1/collection-items',
      buildItemWithCustomTag('Merge Old Tag Movie', oldTag, 'tt9910002')
    );
    await api.request(
      'POST',
      '/api/v1/collection-items',
      buildItemWithCustomTag('Merge New Tag Movie', newTag, 'tt9910003')
    );
    const statisticsResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/collection-items/statistics') && response.request().method() === 'GET'
    );
    const renameResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/v1/users/me/tags/rename') && response.request().method() === 'POST'
    );
    await tagManagementPage.visit();
    await statisticsResponsePromise;

    page.on('dialog', (dialog) => dialog.accept());
    await tagManagementPage.getRenameInput(oldTag).fill(newTag);
    await tagManagementPage.getRenameButton(oldTag).click();
    await renameResponsePromise;

    await expect(tagManagementPage.getRenameInput(newTag)).toHaveValue(newTag);
    await expect(tagManagementPage.findRenameInputHost(oldTag)).toHaveCount(0);
    expect(await getTagCounts(api)).toContainEqual({ tag: newTag, count: 2 });
  });

  test('keeps a shared visible tag when the current user own tag is renamed', async ({ api, page }) => {
    const oldTag = '#shared-rename-old';
    const newTag = '#shared-rename-new';

    const { owner, sharedUser } = await shareHelpers.setupShare(
      libraryMovieSeriesGrants({ canRead: true, canCreate: false, canUpdate: false, canDelete: false }),
      { prefix: 'tm' }
    );
    await shareHelpers.requestAs(
      owner,
      'POST',
      '/api/v1/collection-items',
      buildItemWithCustomTag('Shared Rename Owner Movie', oldTag, 'tt9910004')
    );
    await shareHelpers.requestAs(
      sharedUser,
      'POST',
      '/api/v1/collection-items',
      buildItemWithCustomTag('Shared Rename Current User Movie', oldTag, 'tt9910005')
    );
    await shareHelpers.requestAs(sharedUser, 'POST', '/api/v1/users/me/tags', []);
    await shareHelpers.signInThroughUi(sharedUser);
    const statisticsResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/collection-items/statistics') && response.request().method() === 'GET'
    );
    const renameResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/v1/users/me/tags/rename') && response.request().method() === 'POST'
    );
    await tagManagementPage.visit();
    await statisticsResponsePromise;

    page.on('dialog', (dialog) => dialog.accept());
    await tagManagementPage.getRenameInput(oldTag).fill(newTag);
    await tagManagementPage.getRenameButton(oldTag).click();
    await renameResponsePromise;

    await expect(tagManagementPage.getRenameInput(oldTag)).toHaveValue(oldTag);
    await expect(tagManagementPage.getRenameInput(newTag)).toHaveValue(newTag);
    const tagCounts = await getTagCounts(api, sharedUser);
    expect(tagCounts).toContainEqual({ tag: oldTag, count: 1 });
    expect(tagCounts).toContainEqual({ tag: newTag, count: 1 });
  });

  test('does not rename a shared visible tag when the current user owns no matching item tags', async ({
    api,
    page,
  }) => {
    const oldTag = '#shared-only-old';
    const newTag = '#shared-only-new';

    const { owner, sharedUser } = await shareHelpers.setupShare(
      libraryMovieSeriesGrants({ canRead: true, canCreate: false, canUpdate: false, canDelete: false }),
      { prefix: 'tm' }
    );
    await shareHelpers.requestAs(
      owner,
      'POST',
      '/api/v1/collection-items',
      buildItemWithCustomTag('Shared Only Owner Movie', oldTag, 'tt9910006')
    );
    await shareHelpers.requestAs(sharedUser, 'POST', '/api/v1/users/me/tags', []);
    await shareHelpers.signInThroughUi(sharedUser);
    const statisticsResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/collection-items/statistics') && response.request().method() === 'GET'
    );
    const renameResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/v1/users/me/tags/rename') && response.request().method() === 'POST'
    );
    await tagManagementPage.visit();
    await statisticsResponsePromise;

    page.on('dialog', (dialog) => dialog.accept());
    await tagManagementPage.getRenameInput(oldTag).fill(newTag);
    await tagManagementPage.getRenameButton(oldTag).click();
    const renameResponse = await renameResponsePromise;
    const renameBody = (await renameResponse.json()) as ApiEnvelope<{ renamedItemCount: number }>;
    expect(renameBody.data.renamedItemCount).toBe(0);

    await expect(tagManagementPage.getRenameInput(oldTag)).toHaveValue(oldTag);
    await expect(tagManagementPage.findRenameInputHost(newTag)).toHaveCount(0);
    const tagCounts = await getTagCounts(api, sharedUser);
    expect(tagCounts).toContainEqual({ tag: oldTag, count: 1 });
    expect(tagCounts).not.toContainEqual({ tag: newTag, count: 1 });
  });

  test('keeps the target tag management config when merging tags', async ({ api, page }) => {
    const oldTag = '#merge-config-old';
    const newTag = '#merge-config-new';
    const targetConfig = buildTagManagement(newTag, { color: '#00ff00', useForImageBadge: true, weight: 8 });
    const oldConfig = buildTagManagement(oldTag, { color: '#ff0000', useForImageBorder: true, weight: 3 });
    await api.request(
      'POST',
      '/api/v1/collection-items',
      buildItemWithCustomTag('Merge Config Old Movie', oldTag, 'tt9910007')
    );
    await api.request(
      'POST',
      '/api/v1/collection-items',
      buildItemWithCustomTag('Merge Config New Movie', newTag, 'tt9910008')
    );
    await api.request('POST', '/api/v1/users/me/tags', [oldConfig, targetConfig]);
    const statisticsResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/collection-items/statistics') && response.request().method() === 'GET'
    );
    const renameResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/v1/users/me/tags/rename') && response.request().method() === 'POST'
    );
    await tagManagementPage.visit();
    await statisticsResponsePromise;

    page.on('dialog', (dialog) => dialog.accept());
    await tagManagementPage.getRenameInput(oldTag).fill(newTag);
    await tagManagementPage.getRenameButton(oldTag).click();
    await renameResponsePromise;

    const tagsResponse = await api.request('GET', '/api/v1/users/me/tags');
    const tagsBody = (await tagsResponse.json()) as ApiEnvelope<Array<ReturnType<typeof buildTagManagement>>>;
    expect(tagsBody.data).toContainEqual(targetConfig);
    expect(tagsBody.data).not.toContainEqual(oldConfig);
  });
});

test.describe('Tag Management — effect on collection item', () => {
  const customTag = '#scifi';
  const item = buildItemWithCustomTag('Scifi Collection Movie', customTag);
  const tagColor = '#ff4500';

  test.beforeEach(async ({ api, autoLogin }) => {
    await autoLogin();
    await api.request('POST', '/api/v1/collection-items', item);
  });

  test('applies the tag color as an image border when useForImageBorder is enabled', async ({ api, page }) => {
    await api.request('POST', '/api/v1/users/me/tags', [
      {
        tag: customTag,
        color: tagColor,
        useForImageBorder: true,
        useForTextColor: false,
        useForImageBadge: false,
        weight: 0,
      },
    ]);
    await collectionPage.visit();
    await page.reload();
    await expect(collectionPage.getListItemImages().first()).not.toHaveCSS('border-color', 'rgba(0, 0, 0, 0)');
  });

  test('shows the image badge when useForImageBadge is enabled', async ({ api, page }) => {
    await api.request('POST', '/api/v1/users/me/tags', [
      {
        tag: customTag,
        color: tagColor,
        useForImageBorder: false,
        useForTextColor: false,
        useForImageBadge: true,
        weight: 0,
      },
    ]);
    await collectionPage.visit();
    await page.reload();
    // The badge anchor appears inside the image container
    const badge = collectionPage.getListItemImages().first().locator('.badge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText(customTag);
  });
});
