import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page, TestInfo } from '@playwright/test';
import sharp from 'sharp';
import { buildCollectionItem } from '../fixtures/collection-item';
import { createAboutPage } from '../page-objects/about.po';
import { createCollectionPage } from '../page-objects/collection.po';
import { createSettingsPage } from '../page-objects/settings.po';
import { createSignInPage } from '../page-objects/sign-in.po';
import { createSignUpPage } from '../page-objects/sign-up.po';
import { createStatisticsPage } from '../page-objects/statistics.po';
import { createTagManagementPage } from '../page-objects/tag-management.po';
import { fillAutocomplete } from '../support/input-util';
import { createShareHelpers, grant } from '../support/share-helpers';
import { expect, test } from '../support/test';

const settle = async (locator: Locator) => {
  await locator.evaluate((element) =>
    Promise.all(
      element
        .getAnimations({ subtree: true })
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished)
    )
  );
};

const scan = async (page: Page, testInfo: TestInfo, name: string) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  await testInfo.attach(name, { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
  expect(results.violations).toEqual([]);
};

const expectFullyReachable = async (control: Locator) => {
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeInViewport({ ratio: 1 });
  await expect
    .poll(() =>
      control.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.top >= 0 && bounds.left >= 0 && bounds.bottom <= innerHeight && bounds.right <= innerWidth;
      })
    )
    .toBe(true);
};

const dominantRenderedColor = async (screenshot: Buffer) => {
  const { data, info } = await sharp(screenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const counts = new Map<string, number>();
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const color = `${data[offset]},${data[offset + 1]},${data[offset + 2]}`;
    counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  const dominant = [...counts].sort((a, b) => b[1] - a[1])[0];
  expect(dominant[1]).toBeGreaterThan((info.width * info.height) / 2);
  return dominant[0].split(',').map(Number);
};

const luminance = (color: number[]) =>
  color
    .map((channel) => channel / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);

test.describe('WCAG regressions', () => {
  for (const height of [900, 256]) {
    test(`Functions transfers keyboard focus and every control remains reachable at 320x${height}`, async ({
      page,
      autoLogin,
      api,
    }) => {
      await autoLogin();
      expect(
        (await api.request('POST', '/api/v1/collection-items', buildCollectionItem('Reachable actions'))).status()
      ).toBe(200);
      await page.setViewportSize({ width: 320, height });
      const collectionPage = createCollectionPage(page);
      await collectionPage.visit();
      await expect(collectionPage.getListItems()).toHaveText(['Reachable actions']);
      await collectionPage.getAddNewButton().focus();
      await expect(collectionPage.getAddNewButton()).toBeFocused();
      await expectFullyReachable(collectionPage.getAddNewButton());
      await collectionPage.getShowFunctionsButton().focus();
      await page.keyboard.press('Enter');
      const controls = [
        collectionPage.getCollectionFilterButton('unwatched'),
        collectionPage.getCollectionFilterButton('favorite'),
        collectionPage.getOrderByCreatedAtButton(),
        collectionPage.getOrderByAlphabetButton(),
        collectionPage.getOrderDirectionDescButton(),
        collectionPage.getOrderDirectionAscButton(),
        collectionPage.getRandomPickButton(),
        collectionPage.getHideFunctionsButton(),
      ];
      for (const [index, control] of controls.entries()) {
        if (index > 0) await page.keyboard.press('Tab');
        await expect(control).toBeFocused();
        await expectFullyReachable(control);
      }
      await page.keyboard.press('Enter');
      await expect(collectionPage.getShowFunctionsButton()).toBeFocused();
      await expectFullyReachable(collectionPage.getShowFunctionsButton());
    });
  }

  for (const route of ['sign-in', 'sign-up'] as const) {
    test(`${route} expanded API form can scroll from branding to last control at 320x256`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 256 });
      const loginPage = route === 'sign-in' ? createSignInPage(page) : createSignUpPage(page);
      await loginPage.visit();
      await page.addStyleTag({
        content:
          '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }',
      });
      await loginPage.getChangeApiUrlButton().click();
      await expect(loginPage.getApiUrlInput()).toBeVisible();
      await expectFullyReachable(loginPage.getBrandHeading());
      await loginPage.getUsernameInput().focus();
      await expectFullyReachable(loginPage.getUsernameInput());
      await loginPage.getApiUrlInput().focus();
      await expectFullyReachable(loginPage.getApiUrlInput());
      const lastControl =
        route === 'sign-in' ? createSignInPage(page).getThemeSelect() : createSignUpPage(page).getSignInLink();
      await lastControl.focus();
      await expectFullyReachable(lastControl);
      await expectFullyReachable(loginPage.getBrandHeading());
      await expectFullyReachable(loginPage.getUsernameInput());
    });
  }

  for (const theme of ['light', 'dark'] as const) {
    test(`content surfaces stay opaque in ${theme}`, async ({ page, autoLoginWithNewUser, api }) => {
      await autoLoginWithNewUser();
      expect((await api.request('POST', '/api/v1/users/me/settings', { theme })).status()).toBe(200);
      const collection = createCollectionPage(page);
      await collection.visit();
      await expect(page.locator('html')).toHaveClass(new RegExp(theme));
      const surfaceColor = theme === 'dark' ? 'rgb(22, 38, 48)' : 'rgb(233, 226, 211)';
      expect(
        await collection
          .getList()
          .evaluate((element) => getComputedStyle(element.closest('.collection-container')!).backgroundColor)
      ).toBe(surfaceColor);
      await collection.getAddNewButton().click();
      await expect(page.getByTestId('dialog-frame')).toHaveCSS('background-color', surfaceColor);
      await page.keyboard.press('Escape');
      const statistics = createStatisticsPage(page);
      await statistics.visit();
      await expect(statistics.getContent().locator('..')).toHaveCSS('background-color', surfaceColor);
    });

    test(`collection cards retain distinct surfaces and borders in ${theme}`, async ({
      page,
      autoLogin,
      api,
    }, testInfo) => {
      await autoLogin();
      expect((await api.request('POST', '/api/v1/users/me/settings', { theme })).status()).toBe(200);
      expect(
        (await api.request('POST', '/api/v1/collection-items', buildCollectionItem('Visible card boundary'))).status()
      ).toBe(200);
      const collection = createCollectionPage(page);
      await collection.visit();
      await expect(page.locator('html')).toHaveClass(new RegExp(theme));
      const title = collection.getListItemByTitle('Visible card boundary');
      await expect(title).toBeVisible();
      for (const width of [320, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const surface = await title.evaluate((element) => {
          const card = element.closest('[role="listitem"]')!;
          const style = getComputedStyle(card);
          return {
            background: style.backgroundColor,
            pageBackground: getComputedStyle(card.closest('.collection-container')!).backgroundColor,
            borderColor: style.borderTopColor,
            borderWidth: style.borderTopWidth,
            borderStyle: style.borderTopStyle,
            fits: card.getBoundingClientRect().right <= innerWidth,
          };
        });
        expect(surface.background).not.toBe(surface.pageBackground);
        expect(surface.background).not.toBe('rgba(0, 0, 0, 0)');
        expect(surface.borderColor).not.toBe(surface.background);
        expect(surface.borderColor).not.toBe('rgba(0, 0, 0, 0)');
        expect(surface.borderWidth).toBe('1px');
        expect(surface.borderStyle).toBe('solid');
        expect(surface.fits).toBe(true);
        await scan(page, testInfo, `card-boundary-${theme}-${width}`);
      }
    });

    test(`selected movie chip retains a rendered 3:1 state contrast after blur in ${theme}`, async ({
      page,
      autoLogin,
      api,
    }, testInfo) => {
      await autoLogin();
      expect((await api.request('POST', '/api/v1/users/me/settings', { theme })).status()).toBe(200);
      const collectionPage = createCollectionPage(page);
      await collectionPage.visit();
      await expect(page.locator('html')).toHaveClass(new RegExp(theme));
      const searchInput = await collectionPage.getSearchInput();
      const chip = collectionPage.getMediaChip('movie');
      await expect(chip).toHaveAttribute('aria-pressed', 'false');
      await searchInput.focus();
      await page.mouse.move(0, 0);
      const unselected = await chip.screenshot();
      await chip.click();
      await expect(chip).toHaveAttribute('aria-pressed', 'true');
      await searchInput.focus();
      await page.mouse.move(0, 0);
      await expect(chip).not.toBeFocused();
      await settle(chip);
      const selected = await chip.screenshot();
      const selectedLuminance = luminance(await dominantRenderedColor(selected));
      const unselectedLuminance = luminance(await dominantRenderedColor(unselected));
      const contrast =
        (Math.max(selectedLuminance, unselectedLuminance) + 0.05) /
        (Math.min(selectedLuminance, unselectedLuminance) + 0.05);
      expect(contrast).toBeGreaterThanOrEqual(3);
      await testInfo.attach('selected-chip', { body: selected, contentType: 'image/png' });
      await testInfo.attach('unselected-chip', { body: unselected, contentType: 'image/png' });
    });
  }

  test('no-results status exists before searching, updates without moving focus, and persists after clearing', async ({
    page,
    autoLogin,
    api,
  }) => {
    await autoLogin();
    expect(
      (await api.request('POST', '/api/v1/collection-items', buildCollectionItem('Findable movie'))).status()
    ).toBe(200);
    const collectionPage = createCollectionPage(page);
    await collectionPage.visit();
    await expect(collectionPage.getListItems()).toHaveText(['Findable movie']);
    const status = collectionPage.getSearchStatus();
    await expect(status).toBeAttached();
    await expect(status).toHaveText('');
    await expect(status).toHaveAttribute('role', 'status');
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(status).toHaveAttribute('aria-atomic', 'true');
    expect(await status.evaluate((element) => element.closest('[aria-busy]') === null)).toBe(true);
    const originalStatus = await status.elementHandle();
    if (!originalStatus) throw new Error('Persistent search status is missing');
    const input = await collectionPage.getSearchInput();
    const noResults = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname === '/api/v1/collection-items' &&
        response.url().includes('zzzzunfindabletarget')
    );
    await fillAutocomplete(input, 'zzzzunfindabletarget');
    expect((await noResults).status()).toBe(200);
    await expect(status).toHaveText('No matched content.');
    await expect(input).toBeFocused();
    expect(await originalStatus.evaluate((element) => element.isConnected)).toBe(true);
    const restored = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname === '/api/v1/collection-items' &&
        !response.url().includes('zzzzunfindabletarget')
    );
    await fillAutocomplete(input, '');
    expect((await restored).status()).toBe(200);
    await expect(collectionPage.getListItems()).toHaveText(['Findable movie']);
    await expect(status).toHaveText('');
    expect(await originalStatus.evaluate((element) => element.isConnected)).toBe(true);
    await expect(input).toBeFocused();
  });

  test('series upper-limit errors are visible, field-linked, actionable, and accept corrected limits', async ({
    page,
    autoLogin,
    api,
  }) => {
    await autoLogin();
    const imdbId = 'tt8300100';
    expect(
      (
        await api.request(
          'POST',
          '/api/v1/collection-items',
          buildCollectionItem('Series limits', 'series', imdbId, 'tracking')
        )
      ).status()
    ).toBe(200);
    const collectionPage = createCollectionPage(page);
    await collectionPage.visitTracking();
    await collectionPage.getListItemImages().first().click();
    await collectionPage.openItemActions();
    await collectionPage.getItemDialogManageSeriesMetadataButton().click();
    await collectionPage.getSeriesMetadataAddButton().click();
    const season = collectionPage.getSeriesMetadataSeasonInputs().first();
    const episodes = collectionPage.getSeriesMetadataEpisodeInputs().first();
    await expect(season).toHaveAttribute('max', '50');
    await expect(episodes).toHaveAttribute('max', '100');
    await season.fill('51');
    await page.keyboard.press('Tab');
    await expect(season).toHaveAttribute('aria-invalid', 'true');
    await expect(season).toHaveAccessibleDescription(/50/);
    await expect(collectionPage.getSeriesMetadataSeasonErrors()).toBeVisible();
    await expect(collectionPage.getSeriesMetadataSeasonErrors()).toContainText('whole number from 1 to 50');
    expect((await season.getAttribute('aria-describedby'))?.split(/\s+/)).toContain(
      await collectionPage.getSeriesMetadataSeasonErrors().getAttribute('id')
    );
    await expect(collectionPage.getSeriesMetadataSeasonErrors()).not.toContainText('Validation.');
    await expect(collectionPage.getSeriesMetadataSaveButton()).toBeDisabled();
    await season.fill('1');
    await episodes.fill('101');
    await page.keyboard.press('Tab');
    await expect(episodes).toHaveAttribute('aria-invalid', 'true');
    await expect(episodes).toHaveAccessibleDescription(/100/);
    await expect(collectionPage.getSeriesMetadataEpisodeErrors()).toBeVisible();
    await expect(collectionPage.getSeriesMetadataEpisodeErrors()).toContainText('whole number from 1 to 100');
    expect((await episodes.getAttribute('aria-describedby'))?.split(/\s+/)).toContain(
      await collectionPage.getSeriesMetadataEpisodeErrors().getAttribute('id')
    );
    await expect(collectionPage.getSeriesMetadataEpisodeErrors()).not.toContainText('Validation.');
    await expect(collectionPage.getSeriesMetadataSaveButton()).toBeDisabled();
    await season.fill('50');
    await episodes.fill('100');
    await page.keyboard.press('Tab');
    await expect(collectionPage.getSeriesMetadataSeasonErrors()).toHaveCount(0);
    await expect(collectionPage.getSeriesMetadataEpisodeErrors()).toHaveCount(0);
    await expect(collectionPage.getSeriesMetadataSaveButton()).toBeEnabled();
    const saved = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        new URL(response.url()).pathname === `/api/v1/collection-items/omdb/${imdbId}/tracking/seasons`
    );
    await collectionPage.getSeriesMetadataSaveButton().click();
    expect((await saved).status()).toBe(200);
    await expect(collectionPage.getSeriesMetadataDialogHost()).toHaveCount(0);
  });

  for (const theme of ['light', 'dark'] as const) {
    for (const width of [320, 1000, 1440]) {
      test(`settings navigation keyboard and contrast at ${width}px ${theme}`, async ({
        page,
        autoLogin,
        browserName,
      }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await autoLogin();
        const settingsPage = createSettingsPage(page);
        await settingsPage.visitBasics();
        const saved = page.waitForResponse(
          (response) => response.request().method() === 'POST' && response.url().endsWith('/api/v1/users/me/settings')
        );
        await settingsPage.getThemeSelect().selectOption(theme);
        expect((await saved).status()).toBe(200);
        await expect(settingsPage.getSavedToast()).toBeVisible();
        await settle(settingsPage.getSavedToast().locator('..'));
        await expect(page.locator('html')).toHaveClass(new RegExp(theme));
        const activeLink = settingsPage.getNavLink('basics');
        await expect(activeLink).toHaveAttribute('aria-current', 'page');
        if (width < 1251) {
          await expect(settingsPage.getNavToggle()).toHaveAttribute('aria-expanded', 'false');
          await expect(activeLink).toBeHidden();
          await settingsPage.getNavToggle().focus();
          await page.keyboard.press('Tab');
          if (browserName === 'firefox' && width === 320) {
            await expect(settingsPage.getBasicsScrollRegion()).toBeFocused();
            await page.keyboard.press('Tab');
          }
          await expect(settingsPage.getLanguageSelect()).toBeFocused();
          await scan(page, testInfo, 'collapsed-navigation');
          await settingsPage.getNavToggle().focus();
          await page.keyboard.press('Enter');
          await expect(settingsPage.getNavToggle()).toHaveAttribute('aria-expanded', 'true');
          await expect(activeLink).toBeVisible();
          await settle(activeLink.locator('..'));
          await page.keyboard.press('Tab');
          await expect(activeLink).toBeFocused();
          await scan(page, testInfo, 'expanded-navigation');
          await page.keyboard.press('Enter');
          await expect(settingsPage.getNavToggle()).toHaveAttribute('aria-expanded', 'false');
          await expect(activeLink).toBeHidden();
        } else {
          await expect(settingsPage.getNavToggle()).toBeHidden();
          await expect(activeLink).toBeVisible();
          await settle(activeLink);
          await scan(page, testInfo, 'wide-navigation');
        }
      });
    }
  }

  test('library tag suggestions retain valid listbox semantics', async ({ page, autoLogin, api }, testInfo) => {
    await autoLogin();
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Accessible suggestions'),
      tags: ['#accessible'],
    });
    const collectionPage = createCollectionPage(page);
    await collectionPage.visit();
    await fillAutocomplete(await collectionPage.getSearchInput(), '#acc');
    await expect(collectionPage.getSearchSuggestions().first()).toBeVisible();
    await settle(collectionPage.getSearchHost());
    await scan(page, testInfo, 'library-suggestions');
  });

  test('populated statistics expose visible value before label in native button names', async ({
    page,
    autoLogin,
    api,
  }, testInfo) => {
    await autoLogin();
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Accessible statistics'),
      tags: ['#accessible'],
      favorite: true,
    });
    const statisticsPage = createStatisticsPage(page);
    await statisticsPage.visit();
    await statisticsPage.collectionView().click();
    await expect(statisticsPage.getSummary()).toBeVisible();
    const cards = statisticsPage.getSummaryCards();
    expect(await cards.count()).toBeGreaterThan(0);
    for (const card of await cards.all()) {
      const visibleName = (await card.innerText()).replace(/\s+/g, ' ').trim();
      await expect(card).toHaveAccessibleName(visibleName);
    }
    await expect(statisticsPage.getTag('#accessible')).toBeVisible();
    await statisticsPage.getOverviewChartCard().scrollIntoViewIfNeeded();
    await expect(statisticsPage.getOverviewChartCard()).toContainText('1');
    await settle(statisticsPage.getContent());
    await testInfo.attach('populated-statistics', {
      body: await statisticsPage.getOverviewChartCard().screenshot(),
      contentType: 'image/png',
    });
    await scan(page, testInfo, 'populated-statistics');
  });

  test('selected tag colour name includes tag and visible hex value', async ({ page, autoLogin, api }, testInfo) => {
    await autoLogin();
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Accessible tag colour'),
      tags: ['#accessible'],
    });
    const tagsPage = createTagManagementPage(page);
    await tagsPage.visit();
    await expect(tagsPage.getColorButton('#accessible')).toBeVisible();
    const saved = page.waitForResponse(
      (response) => response.request().method() === 'POST' && response.url().endsWith('/api/v1/users/me/tags')
    );
    await tagsPage.setColor('#accessible', '#245678');
    expect((await saved).status()).toBe(200);
    await expect(tagsPage.getColorButton('#accessible')).toHaveAccessibleName(/#accessible.*#245678/i);
    await expect(tagsPage.getColorButton('#accessible')).toContainText('#245678');
    const settingsPage = createSettingsPage(page);
    await expect(settingsPage.getSavedToast()).toBeVisible();
    await settle(settingsPage.getSavedToast().locator('..'));
    await scan(page, testInfo, 'selected-tag-colour');
  });

  test('shares empty messages and populated cards retain readable contrast', async ({ page, api }, testInfo) => {
    const shares = createShareHelpers(page, api);
    try {
      const owner = await shares.createUser('owner', 'wcag');
      const recipient = await shares.createUser('reader', 'wcag');
      await shares.signInThroughUi(owner);
      const settingsPage = createSettingsPage(page);
      await settingsPage.visitShares();
      await expect(settingsPage.getShareCode()).toContainText(owner.shareCode);
      await scan(page, testInfo, 'empty-shares');
      expect(
        (
          await shares.requestAs(owner, 'POST', '/api/v1/users/me/shares', {
            sharedWithUserShareCode: recipient.shareCode,
            grants: [grant('library', 'movie', { canRead: true })],
          })
        ).status()
      ).toBe(204);
      await settingsPage.reloadShares();
      await expect(settingsPage.getEditShareButton(recipient.shareCode)).toBeVisible();
      await scan(page, testInfo, 'outgoing-share-card');
      await shares.signInThroughUi(recipient);
      await settingsPage.visitShares();
      await expect(settingsPage.getViewIncomingShareButton(owner.shareCode)).toBeVisible();
      await scan(page, testInfo, 'incoming-share-card');
    } finally {
      await shares.cleanupCreatedUsers();
    }
  });

  test('completed episode titles remain readable', async ({ page, autoLogin, api }, testInfo) => {
    await autoLogin();
    const imdbId = 'tt8300099';
    await api.request(
      'POST',
      '/api/v1/collection-items',
      buildCollectionItem('Accessible episodes', 'series', imdbId, 'tracking')
    );
    await api.request('PUT', `/api/v1/collection-items/omdb/${imdbId}/tracking/seasons`, {
      seasons: [{ season: 1, episodes: 2, titles: ['Completed pilot title', 'Next episode title'] }],
    });
    await api.request('PUT', `/api/v1/collection-items/omdb/${imdbId}/tracking/completed-episodes`, {
      completedEpisodes: [{ season: 1, episode: 1 }],
    });
    const collectionPage = createCollectionPage(page);
    await collectionPage.visitTracking();
    await collectionPage.getListItemImages().first().click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogManageCompletedEpisodesButton().click();
    await expect(collectionPage.getCompletedEpisodesEpisodeCheckbox().first()).toBeChecked();
    await expect(collectionPage.getCompletedEpisodesDialog()).toContainText('Completed pilot title');
    await settle(collectionPage.getCompletedEpisodesDialog());
    await scan(page, testInfo, 'titled-completed-episodes');
  });

  test('About link-buttons show keyboard focus outline', async ({ page, autoLogin }) => {
    await autoLogin();
    const aboutPage = createAboutPage(page);
    await aboutPage.visit();
    await expect(aboutPage.getGithubLink()).toBeVisible();
    await aboutPage.getHealthLink().focus();
    await page.keyboard.press('Tab');
    await expect(aboutPage.getGithubLink()).toBeFocused();
    const outline = await aboutPage.getGithubLink().evaluate((link) => {
      const style = getComputedStyle(link);
      return { style: style.outlineStyle, width: parseFloat(style.outlineWidth), color: style.outlineColor };
    });
    expect(outline.style).not.toBe('none');
    expect(outline.width).toBeGreaterThanOrEqual(2);
    expect(outline.color).not.toBe('rgba(0, 0, 0, 0)');
  });
});
