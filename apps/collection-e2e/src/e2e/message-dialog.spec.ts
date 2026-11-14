import { expect, test } from '@playwright/test';
import { createMessageDialog } from '../page-objects/message-dialog.po';

for (const action of ['confirm', 'cancel'] as const) {
  test(`message dialog ${action} waits only for the original dialog`, async ({ page }) => {
    await page.setContent(`
      <section data-test-id="message-dialog">
        <div data-test-id="dialog-frame">
          <h2 id="original-title" data-test-id="message-dialog-title">Confirm action</h2>
          <button data-test-id="message-dialog-${action}">Continue</button>
        </div>
      </section>
    `);
    const dialog = createMessageDialog(page);
    const button = action === 'confirm' ? dialog.getConfirmButton() : dialog.getCancelButton();
    await button.evaluate((button) =>
      button.addEventListener('click', () => {
        const original = button.closest('section')!;
        const replacement = original.cloneNode(true) as HTMLElement;
        replacement.querySelector('h2')!.id = 'replacement-title';
        original.replaceWith(replacement);
      })
    );

    await dialog[action]();

    await expect(dialog.getTitle()).toHaveAttribute('id', 'replacement-title');
    await expect(dialog.getDialog()).toBeVisible();
  });
}
