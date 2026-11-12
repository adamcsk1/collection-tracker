import type { Page } from '@playwright/test';

export const createItemSharingDialog = (page: Page) => {
  const getItemShareDialog = () => page.getByTestId('item-share-dialog').last().getByTestId('dialog-frame');

  return {
    getDialogHost: () => page.getByTestId('item-share-dialog'),
    getDialog: getItemShareDialog,
    getTitle: () => getItemShareDialog().getByTestId('item-share-dialog-title'),
    getRecipientCheckbox: (recipientShareCode: string) =>
      getItemShareDialog().getByTestId(`item-share-recipient-${recipientShareCode}`).locator('input[type="checkbox"]'),
    getPermissions: (recipientShareCode: string) =>
      getItemShareDialog().getByTestId(`item-share-permissions-${recipientShareCode}`),
    getPermissionCheckbox: (
      recipientShareCode: string,
      permission: 'can-read' | 'can-create' | 'can-update' | 'can-delete'
    ) =>
      getItemShareDialog()
        .getByTestId(`item-share-${permission}-${recipientShareCode}`)
        .locator('input[type="checkbox"]'),
    getSaveButton: () => getItemShareDialog().getByTestId('item-share-save'),
  };
};
