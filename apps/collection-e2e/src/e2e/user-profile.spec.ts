import { buildAvatar } from '../fixtures/avatar';
import { createProfilePage } from '../page-objects/profile.po';
import { createSettingsPage } from '../page-objects/settings.po';
import { createCollectionPage } from '../page-objects/collection.po';
import { createShareHelpers, grant, uniqueImdbId } from '../support/share-helpers';
import { buildCollectionItem } from '../fixtures/collection-item';
import { expect, test } from '../support/test';
import { createCommonPage } from '../page-objects/common.po';

test('keeps profile controls within mobile content without narrowing desktop', async ({ page, autoLogin }) => {
  await autoLogin();
  const profile = createProfilePage(page);
  await profile.visit();

  for (const width of [320, 390, 520, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(profile.save()).toBeVisible();
    const editor = await profile.editor().boundingBox();
    expect(editor).not.toBeNull();
    for (const control of [profile.save(), profile.file()]) {
      const bounds = await control.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(editor!.x);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(editor!.x + editor!.width + 1);
    }
    expect(await profile.editor().evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    if (width === 1440) expect(editor!.width).toBeGreaterThan(320);
  }
});

test('edits a profile, uploads and replaces a photo, rejects invalid replacement, then removes it', async ({
  page,
  api,
  autoLoginWithNewUser,
}) => {
  await autoLoginWithNewUser();
  const profile = createProfilePage(page);
  try {
    await profile.visit();
    await profile.displayName().fill('Profile display name');
    const save = page.waitForResponse(
      (response) => response.request().method() === 'PATCH' && response.url().endsWith('/users/me/profile')
    );
    await profile.save().click();
    expect((await save).status()).toBe(200);
    await expect(profile.name()).toHaveText('Profile display name');

    let previousRevision: string | null = null;
    let previousBytes: Buffer = Buffer.alloc(0);
    let avatarPath = '';
    for (const color of ['#336699', '#993366']) {
      await profile
        .file()
        .setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: await buildAvatar(color) });
      await expect(profile.preview()).toBeVisible();
      const upload = page.waitForResponse(
        (response) => response.request().method() === 'PUT' && response.url().endsWith('/users/me/avatar')
      );
      await profile.upload().click();
      const uploaded = await upload;
      expect(uploaded.status()).toBe(200);
      const { data: savedProfile }: { data: { userShareCode: string; avatarRevision: string | null } } =
        await uploaded.json();
      expect(savedProfile.avatarRevision).toEqual(expect.any(String));
      expect(savedProfile.avatarRevision).not.toBe(previousRevision);
      avatarPath = `/api/v1/users/${savedProfile.userShareCode}/avatar`;
      const storedAvatar = await api.request('GET', avatarPath);
      expect(storedAvatar.status()).toBe(200);
      const storedBytes = await storedAvatar.body();
      expect(storedBytes).not.toEqual(previousBytes);
      await expect(profile.preview()).toHaveCount(0);
      await expect(profile.avatar()).toBeVisible();
      await expect(profile.avatar()).toHaveAttribute('src', /^blob:/);
      await expect.poll(() => profile.imageBytes(profile.avatar())).toEqual(storedBytes);
      previousRevision = savedProfile.avatarRevision;
      previousBytes = storedBytes;
    }
    await profile
      .file()
      .setInputFiles({ name: 'invalid.png', mimeType: 'image/png', buffer: Buffer.from('invalid image') });
    const invalid = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && response.url().endsWith('/users/me/avatar')
    );
    await profile.upload().click();
    expect((await invalid).status()).toBe(400);
    await expect(profile.error()).toBeVisible();
    await expect(profile.avatar()).toBeVisible();
    const preservedProfile = await api.request('GET', '/api/v1/users/me/profile');
    expect((await preservedProfile.json()).data.avatarRevision).toBe(previousRevision);
    expect(await (await api.request('GET', avatarPath)).body()).toEqual(previousBytes);
    expect(await profile.imageBytes(profile.avatar())).toEqual(previousBytes);
    await page.reload();
    await expect(profile.name()).toHaveText('Profile display name');
    await expect(profile.avatar()).toBeVisible();
    const reloadedProfile = await api.request('GET', '/api/v1/users/me/profile');
    expect((await reloadedProfile.json()).data.avatarRevision).toBe(previousRevision);
    expect(await (await api.request('GET', avatarPath)).body()).toEqual(previousBytes);
    expect(await profile.imageBytes(profile.avatar())).toEqual(previousBytes);
    const remove = page.waitForResponse(
      (response) => response.request().method() === 'DELETE' && response.url().endsWith('/users/me/avatar')
    );
    await profile.remove().click();
    expect((await remove).status()).toBe(200);
    await expect(profile.fallback()).toBeVisible();
  } finally {
    await api.request('DELETE', '/api/v1/users/me');
  }
});

test('shows shared profile names and owner photos without per-item profile lookups', async ({ page, api }) => {
  const helpers = createShareHelpers(page, api);
  const settings = createSettingsPage(page);
  const collection = createCollectionPage(page);
  const profile = createProfilePage(page);
  const common = createCommonPage(page);
  try {
    const { owner, sharedUser } = await helpers.setupShare([grant('library', 'movie')]);
    await helpers.requestAs(owner, 'PATCH', '/api/v1/users/me/profile', { displayName: 'Shared owner name' });
    await helpers.requestAs(sharedUser, 'PATCH', '/api/v1/users/me/profile', { displayName: 'Recipient name' });
    await helpers.requestAs(owner, 'PUT', '/api/v1/users/me/avatar', {
      imageBase64: (await buildAvatar()).toString('base64'),
    });
    await helpers.requestAs(sharedUser, 'PUT', '/api/v1/users/me/avatar', {
      imageBase64: (await buildAvatar('#993366')).toString('base64'),
    });
    const ownerBytes = await (await helpers.requestAs(owner, 'GET', `/api/v1/users/${owner.shareCode}/avatar`)).body();
    const recipientBytes = await (
      await helpers.requestAs(sharedUser, 'GET', `/api/v1/users/${sharedUser.shareCode}/avatar`)
    ).body();
    expect(recipientBytes).not.toEqual(ownerBytes);
    for (const title of ['Shared profile movie', 'Another shared profile movie']) {
      await helpers.requestAs(
        owner,
        'POST',
        '/api/v1/collection-items',
        buildCollectionItem(title, 'movie', uniqueImdbId())
      );
    }
    await helpers.requestAs(
      sharedUser,
      'POST',
      '/api/v1/collection-items',
      buildCollectionItem('Own profile movie', 'movie', uniqueImdbId())
    );
    await helpers.signInThroughUi(sharedUser);
    await settings.visitShares();
    await expect(settings.getViewIncomingShareButton(owner.shareCode)).toBeVisible();
    await settings.getViewIncomingShareButton(owner.shareCode).click();
    await expect(settings.getShareDialogTitle()).toContainText('Shared owner name');
    await page.keyboard.press('Escape');
    let avatarRequests = 0;
    let sessionProfileRequests = 0;
    let otherProfileRequests = 0;
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (path.endsWith(`/users/${owner.shareCode}/avatar`)) avatarRequests++;
      if (path.endsWith('/users/me/profile')) sessionProfileRequests++;
      else if (/\/users\/[^/]+\/profile$/.test(path)) otherProfileRequests++;
    });
    await collection.visit();
    const ownerThumbnail = collection.getSharedBadges().first();
    await expect(collection.getSharedBadges()).toHaveCount(2);
    await expect(ownerThumbnail).toHaveAttribute('aria-label', 'Shared: Shared owner name');
    await expect(ownerThumbnail.getByTestId('avatar-image')).toBeVisible();
    await expect(collection.getSharedBadges().nth(1).getByTestId('avatar-image')).toBeVisible();
    expect(await profile.imageBytes(ownerThumbnail.getByTestId('avatar-image'))).toEqual(ownerBytes);
    expect(avatarRequests).toBe(1);
    expect(sessionProfileRequests).toBe(1);
    expect(otherProfileRequests).toBe(0);
    for (const marker of ['avatar-image', 'avatar-fallback']) {
      if (marker === 'avatar-fallback') await ownerThumbnail.getByTestId('avatar-image').dispatchEvent('error');
      const avatar = ownerThumbnail.getByTestId(marker);
      await expect(avatar).toBeVisible();
      const geometry = await avatar.evaluate((element) => {
        const host = element.parentElement;
        if (!host) throw new Error('Missing avatar host');
        const bounds = host.getBoundingClientRect();
        const style = getComputedStyle(host);
        return {
          width: bounds.width,
          height: bounds.height,
          radius: style.borderRadius,
          border: style.borderTopWidth,
          boxSizing: style.boxSizing,
          metadataSize: parseFloat(getComputedStyle(host.parentElement!).fontSize),
        };
      });
      expect(geometry.width).toBeCloseTo(geometry.metadataSize, 1);
      expect(geometry.height).toBeCloseTo(geometry.metadataSize, 1);
      expect(geometry.radius).toBe('50%');
      expect(geometry.border).toBe('1px');
      expect(geometry.boxSizing).toBe('border-box');
      const rowHeights = await collection
        .getListItemYears()
        .evaluateAll((elements) =>
          elements.map((element) => element.parentElement!.parentElement!.getBoundingClientRect().height)
        );
      expect(rowHeights).toHaveLength(3);
      expect(Math.max(...rowHeights) - Math.min(...rowHeights)).toBeLessThan(1);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await common.openMenu();
    const mobileIdentity = common.getMenuNavItem('nav-profile');
    await expect(mobileIdentity).toContainText('Recipient name');
    await expect(mobileIdentity.getByTestId('avatar-image')).toHaveAttribute('alt', 'Recipient name');
    expect(await profile.imageBytes(mobileIdentity.getByTestId('avatar-image'))).toEqual(recipientBytes);
    const logout = page.waitForResponse(
      (response) => response.request().method() === 'DELETE' && response.url().endsWith('/auth/session')
    );
    await common.openAccountMenu();
    await common.getNavLogoutLink().click();
    expect((await logout).status()).toBe(204);
    await expect(page).toHaveURL(/\/login\//);
    await helpers.signInThroughUi(owner);
    await page.setViewportSize({ width: 1440, height: 900 });
    const desktopIdentity = common.getAccountTrigger();
    await expect(common.getMenuDialog()).toHaveCount(0);
    await expect(desktopIdentity).toBeInViewport({ ratio: 1 });
    await expect
      .poll(() => desktopIdentity.evaluate((element) => element.getBoundingClientRect().bottom))
      .toBeGreaterThan(800);
    await expect(desktopIdentity).toContainText('Shared owner name');
    await expect(desktopIdentity).not.toContainText('Recipient name');
    await expect(desktopIdentity.getByTestId('avatar-image')).toHaveAttribute('alt', 'Shared owner name');
    expect(await profile.imageBytes(desktopIdentity.getByTestId('avatar-image'))).toEqual(ownerBytes);
    await settings.visitShares();
    await expect(profile.namedAvatar('Recipient name')).toBeVisible();
    expect(await profile.imageBytes(profile.namedAvatar('Recipient name'))).toEqual(recipientBytes);
    await settings.getEditShareButton(sharedUser.shareCode).click();
    await expect(settings.getShareDialogTitle()).toContainText('Recipient name');
    await expect(profile.shareDialogAvatar()).toHaveAttribute('alt', 'Recipient name');
    expect(await profile.imageBytes(profile.shareDialogAvatar())).toEqual(recipientBytes);
  } finally {
    await helpers.cleanupCreatedUsers();
  }
});
