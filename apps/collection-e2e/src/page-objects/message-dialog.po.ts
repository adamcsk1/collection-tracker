import type { Page } from '@playwright/test';

export const createMessageDialog = (page: Page) => {
  const getDialogHost = () => page.getByTestId('message-dialog');
  const getDialog = () => getDialogHost().getByTestId('dialog-frame');
  const getInput = () => getDialogHost().getByTestId('message-dialog-input').locator('input');
  const getConfirmButton = () => getDialogHost().getByTestId('message-dialog-confirm');
  const getCancelButton = () => getDialogHost().getByTestId('message-dialog-cancel');
  const getTitle = () => getDialogHost().getByTestId('message-dialog-title');

  return {
    getDialogHost,
    getDialog,
    getInput,
    getConfirmButton,
    getCancelButton,
    getDragHandle: () => getDialogHost().getByTestId('dialog-drag-handle'),
    getTitle,
    getMessage: () => getDialogHost().getByTestId('message-dialog-message'),
    confirm: async (confirmationText?: string) => {
      await getDialog().waitFor({ state: 'visible' });
      const titleId = await getTitle().evaluate((title) => title.id);
      if (confirmationText !== undefined) await getInput().fill(confirmationText);
      await getConfirmButton().click();
      await page.waitForFunction((titleId) => !document.getElementById(titleId), titleId);
    },
    cancel: async () => {
      const titleId = await getTitle().evaluate((title) => title.id);
      await getCancelButton().click();
      await page.waitForFunction((titleId) => !document.getElementById(titleId), titleId);
    },
  };
};
