const getItemShareDialog = () => cy.getByTestId('item-share-dialog').last().find('[data-test-id="dialog-frame"]');

export const ItemSharingDialog = {
  getDialogHost: () => cy.getByTestId('item-share-dialog'),
  getDialog: getItemShareDialog,
  getTitle: () => getItemShareDialog().find('[data-test-id="item-share-dialog-title"]'),
  getRecipientCheckbox: (recipientShareCode: string) =>
    getItemShareDialog()
      .find(`[data-test-id="item-share-recipient-${recipientShareCode}"]`)
      .find('input[type="checkbox"]'),
  getPermissions: (recipientShareCode: string) =>
    getItemShareDialog().find(`[data-test-id="item-share-permissions-${recipientShareCode}"]`),
  getPermissionCheckbox: (
    recipientShareCode: string,
    permission: 'can-read' | 'can-create' | 'can-update' | 'can-delete'
  ) =>
    getItemShareDialog()
      .find(`[data-test-id="item-share-${permission}-${recipientShareCode}"]`)
      .find('input[type="checkbox"]'),
  getSaveButton: () => getItemShareDialog().find('[data-test-id="item-share-save"]'),
};
