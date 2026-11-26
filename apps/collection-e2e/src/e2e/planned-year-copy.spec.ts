import { buildCollectionItem } from '../fixtures/collection-item';
import { createCollectionPage } from '../page-objects/collection.po';
import { createShareHelpers, grant, uniqueImdbId } from '../support/share-helpers';
import { expect, test } from '../support/test';

for (const shared of [false, true]) {
  test(`${shared ? 'shared' : 'own'} library movie ${shared ? 'does not copy' : 'retains'} planned year when finished`, async ({
    page,
    api,
  }) => {
    const shares = createShareHelpers(page, api);
    const collection = createCollectionPage(page);
    const plannedYear = new Date().getFullYear() + 1;
    const title = shared ? 'Shared planned movie' : 'Own planned movie';
    const externalItemId = uniqueImdbId();

    try {
      const { owner, sharedUser } = await shares.setupShare([grant('library', 'movie')]);
      const sourceOwner = shared ? owner : sharedUser;
      const seeded = await shares.requestAs(sourceOwner, 'POST', '/api/v1/collection-items', {
        ...buildCollectionItem(title, 'movie', externalItemId, 'library'),
        plannedYear,
      });
      expect(seeded.status()).toBe(200);

      await shares.signInThroughUi(sharedUser);
      await collection.visit();
      await collection.getListItemByTitle(title).click();
      if (shared) await expect(collection.getItemDialogSharedLibraryBadge()).toBeVisible();

      const copied = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === `/api/v1/collection-items/omdb/${externalItemId}/tracking`
      );
      await collection.getItemDialogMarkFinishedButton().click();
      expect((await copied).status()).toBe(200);
      await expect(collection.getItemDialogMarkUnfinishedButton()).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(collection.getItemDialogShellHost()).toHaveCount(0);

      await collection.visitTrackingWithQuery('shared=mine');
      await collection.getListItemByTitle(title).click();
      await expect(collection.getItemDialogHost()).toBeVisible();
      await collection.openItemActions();
      await collection.getItemDialogEditButton().click();
      await expect(collection.getItemDialogPlannedYearInput()).toHaveValue(shared ? '' : `${plannedYear}`);

      const source = await shares.requestAs(
        sourceOwner,
        'GET',
        '/api/v1/collection-items?listType=library&shared=mine'
      );
      expect(source.status()).toBe(200);
      expect((await source.json()).data).toEqual([
        expect.objectContaining({ externalItemId, plannedYear, listType: 'library' }),
      ]);
    } finally {
      await shares.cleanupCreatedUsers();
    }
  });
}
