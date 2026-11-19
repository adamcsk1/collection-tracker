import { buildCollectionItem } from '../fixtures/collection-item';
import { createCollectionPage } from '../page-objects/collection.po';
import { createMessageDialog } from '../page-objects/message-dialog.po';
import { expect, test } from '../support/test';

test('browser Back preserves a cancelled edit draft and closes after confirmed discard', async ({
  page,
  api,
  autoLogin,
}) => {
  await autoLogin();
  await api.request('POST', '/api/v1/collection-items', buildCollectionItem('Navigation Draft'));
  const collection = createCollectionPage(page);
  const message = createMessageDialog(page);
  await collection.visit();
  await collection.getListItemTitleButtons().first().click();
  await expect(page).toHaveURL(/item=/);
  const itemUrl = page.url();
  await collection.openItemActions();
  await collection.getItemDialogEditButton().click();
  await collection.getItemDialogTitleInput().fill('Keep this edited title');

  await page.evaluate(() => history.back());
  await message.cancel();
  await expect(page).toHaveURL(itemUrl);
  await expect(collection.getItemDialogTitleInput()).toHaveValue('Keep this edited title');

  await page.evaluate(() => history.back());
  await message.confirm();
  await expect(page).not.toHaveURL(/item=/);
  await expect(collection.getItemDialogHost()).toHaveCount(0);
  await expect(collection.getListItemTitleButtons().first()).toContainText('Navigation Draft');
});

test('route changes preserve cancelled additions and remove confirmed additions', async ({ page, autoLogin }) => {
  await autoLogin();
  const collection = createCollectionPage(page);
  const message = createMessageDialog(page);
  await collection.openNewItemDialog();
  await collection.getNewItemManualModeButton().click();
  await collection.getNewItemManualTitleInput().fill('Unsaved addition');
  const originalUrl = page.url();
  await page.evaluate(() => {
    location.hash = '/about';
  });
  await message.cancel();
  await expect(page).toHaveURL(originalUrl);
  await expect(collection.getNewItemManualTitleInput()).toHaveValue('Unsaved addition');
  await page.evaluate(() => {
    location.hash = '/about';
  });
  await message.confirm();
  await expect(page).toHaveURL(/#\/about$/);
  await expect(collection.getNewItemManualTitleInput()).toHaveCount(0);
});
