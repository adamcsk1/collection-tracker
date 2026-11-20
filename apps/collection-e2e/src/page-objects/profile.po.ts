import type { Locator, Page } from '@playwright/test';

export const createProfilePage = (page: Page) => ({
  visit: () => page.goto('/client/#/settings/account'),
  name: () => page.getByTestId('profile-name'),
  displayName: () => page.getByTestId('profile-display-name').locator('input'),
  save: () => page.getByTestId('profile-save'),
  file: () => page.getByTestId('profile-avatar-file'),
  preview: () => page.getByTestId('profile-avatar-preview'),
  upload: () => page.getByTestId('profile-avatar-upload'),
  remove: () => page.getByTestId('profile-avatar-remove'),
  avatar: () => page.getByTestId('profile-editor').getByTestId('avatar-image'),
  namedAvatar: (name: string) =>
    page.getByTestId('avatar-image').and(page.getByRole('img', { name, exact: true, includeHidden: true })),
  shareDialogAvatar: () => page.getByTestId('share-dialog').getByTestId('avatar-image'),
  imageBytes: async (image: Locator): Promise<Buffer> =>
    Buffer.from(
      await image.evaluate(async (element: HTMLImageElement) =>
        Array.from(new Uint8Array(await (await fetch(element.src)).arrayBuffer()))
      )
    ),
  fallback: () => page.getByTestId('profile-editor').getByTestId('avatar-fallback'),
  error: () => page.getByTestId('profile-error'),
});
