import { buildCollectionItem } from '../fixtures/collection-item';
import { buildBooksItem } from '../fixtures/openlibrary';
import { CollectionPage } from '../page-objects/collection.po';
import { CommonPage } from '../page-objects/common.po';
import { SettingsPage } from '../page-objects/settings.po';

// Suppress background Angular HTTP errors (token validation, preloadUserSettings, etc.)
// throughout this spec. Tests here validate DOM / UI state, not HTTP error handling.
beforeEach(() => {
  cy.on('uncaught:exception', () => false);
});

/**
 * Pre-opens all collapsible details sections in the settings page so that
 * Cypress can interact with their contents without needing to click summaries.
 * Call before SettingsPage.visit().
 */
const openSettingsSections = () => {
  cy.window().then((win) => {
    win.localStorage.setItem('CT.DetailsBasics', 'true');
    win.localStorage.setItem('CT.DetailsUser', 'true');
    win.localStorage.setItem('CT.DetailsAccess tokens', 'true');
    win.localStorage.setItem('CT.DetailsImages', 'true');
    win.localStorage.setItem('CT.DetailsManage tracker data', 'true');
  });
};

describe('Settings - basic form fields', () => {
  beforeEach(() => {
    cy.autoLogin();
    openSettingsSections();
    SettingsPage.visitBasics();
  });

  it('shows the language select', () => {
    SettingsPage.getLanguageSelect().should('be.visible');
  });

  it('shows the theme select with options', () => {
    SettingsPage.getThemeSelect().should('be.visible');
    SettingsPage.getThemeSelect().find('option').should('have.length.at.least', 1);
  });

  it('shows the animated background checkbox', () => {
    SettingsPage.getAnimatedBackgroundCheckbox().should('exist');
  });

  it('shows the sensitive data storage select', () => {
    SettingsPage.getSensitiveDataStorageSelect().should('be.visible');
  });

  it('shows the clear-local-storage-after-logout checkbox when storage is local (default)', () => {
    SettingsPage.getClearLocalStorageCheckbox().should('exist');
  });

  it('hides the clear-local-storage-after-logout checkbox when storage is switched to session', () => {
    SettingsPage.getSensitiveDataStorageSelect().select('session');
    cy.getByTestId('settings-clear-local-storage-after-logout').should('not.exist');
  });
});

describe('Settings - media refresh page', () => {
  beforeEach(() => {
    cy.autoLogin();
    SettingsPage.visitMediaRefresh();
  });

  it('shows the media refresh action buttons', () => {
    SettingsPage.getImageRefreshStartButton().should('be.visible');
    SettingsPage.getExternalRatingsRefreshStartButton().should('be.visible');
  });

  it('calls the refresh images API when the image refresh button is clicked', () => {
    cy.intercept('POST', '/api/v1/collection-items/actions/refresh-images').as('refreshImages');
    SettingsPage.getImageRefreshStartButton().click();
    cy.wait('@refreshImages').its('response.statusCode').should('eq', 200);
    SettingsPage.getImageRefreshStatus()
      .should('be.visible')
      .and('contain.text', 'Count')
      .and('contain.text', 'Checked')
      .and('contain.text', 'Fixed')
      .and('contain.text', 'Errors');
  });
});

describe('Settings - collection list display page', () => {
  beforeEach(() => {
    cy.autoLoginWithNewUser();
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('List Display Test Movie', 'movie', 'tt8100001'),
      rottenTomatoesRate: '96%',
      metacriticRate: '85/100',
    });
  });

  it('shows the display preference controls', () => {
    SettingsPage.visitCollectionListDisplay();

    SettingsPage.getCollectionListDisplayForm().should('be.visible');
    SettingsPage.getListShowYearCheckbox().should('exist');
    SettingsPage.getListShowSharedIconCheckbox().should('exist');
    SettingsPage.getListPreferredRatingSelect().should('be.visible');
    SettingsPage.getListImdbRatingFallbackCheckbox().should('exist');
  });

  it('applies preferred rating and year visibility to the collection list', () => {
    SettingsPage.visitCollectionListDisplay();
    cy.intercept('POST', '/api/v1/users/me/settings').as('saveSettings');

    SettingsPage.getListShowYearCheckbox().uncheck();
    cy.wait('@saveSettings').its('response.statusCode').should('eq', 200);
    SettingsPage.getListPreferredRatingSelect().select('metacritic');
    cy.wait('@saveSettings').its('response.statusCode').should('eq', 200);

    CollectionPage.visit();
    CollectionPage.getListItems().contains('List Display Test Movie').should('be.visible');
    cy.getByTestId('list-item-year').should('not.exist');
    CollectionPage.getListItemMetacriticRatings().should('contain.text', '85/100');
    cy.getByTestId('list-item-rating-imdb').should('not.exist');
  });
});

describe('Settings - features page', () => {
  beforeEach(() => {
    cy.autoLogin();
  });

  it('persists disabled features and hides their menu links', () => {
    SettingsPage.visitFeatures();
    cy.intercept('POST', '/api/v1/users/me/settings').as('saveSettings');

    SettingsPage.getFeaturesForm().should('be.visible');
    SettingsPage.getFeatureWishlistCheckbox().uncheck();
    cy.wait('@saveSettings').its('response.statusCode').should('eq', 200);
    SettingsPage.getFeatureUpNextCheckbox().uncheck();
    cy.wait('@saveSettings').its('response.statusCode').should('eq', 200);
    SettingsPage.getFeatureTrackingCheckbox().uncheck();
    cy.wait('@saveSettings').its('response.statusCode').should('eq', 200);

    cy.reload();
    SettingsPage.getFeatureWishlistCheckbox().should('not.be.checked');
    SettingsPage.getFeatureUpNextCheckbox().should('not.be.checked');
    SettingsPage.getFeatureTrackingCheckbox().should('not.be.checked');

    CommonPage.openMenu();
    CommonPage.getMenuNavItem('nav-wishlist').should('not.exist');
    CommonPage.getMenuNavItem('nav-up-next').should('not.exist');
    CommonPage.getMenuNavItem('nav-tracking').should('not.exist');

    cy.visit('/client/#/collection/tracking');
    cy.url().should('include', '/collection/tracking');

    cy.request(
      'POST',
      '/api/v1/collection-items',
      buildCollectionItem('Feature Statistics Movie', 'movie', 'tt8100002')
    );
    cy.visit('/client/#/statistics');
    cy.getByTestId('statistics-summary-all').should('be.visible');
    cy.getByTestId('statistics-summary-wishlist').should('not.exist');
    cy.getByTestId('statistics-summary-up-next').should('not.exist');
    cy.getByTestId('statistics-summary-watched-movies').should('not.exist');
    cy.getByTestId('statistics-summary-watched-series').should('not.exist');
  });

  it('hides the connected tracking option when adding a series', () => {
    SettingsPage.visitFeatures();
    cy.intercept('POST', '/api/v1/users/me/settings').as('saveSettings');
    SettingsPage.getFeatureTrackingCheckbox().uncheck();
    cy.wait('@saveSettings').its('response.statusCode').should('eq', 200);

    CollectionPage.visit();
    CollectionPage.getAddFirstItemLink().click();
    CollectionPage.getNewItemManualModeButton().click();
    CollectionPage.getNewItemManualContentTypeSelect().select('series');
    cy.getByTestId('new-item-copy-to-tracking-as-completed').should('not.exist');
  });

  it('opens feature settings from the settings navigation', () => {
    SettingsPage.visitBasics();

    cy.getByTestId('settings-nav-features').scrollIntoView().click({ force: true });

    cy.url().should('include', '/settings/features');
    SettingsPage.getFeaturesForm().should('be.visible');
  });

  it('uses session storage for the feature cache when configured', () => {
    SettingsPage.visitBasics();
    SettingsPage.getSensitiveDataStorageSelect().select('session');
    SettingsPage.visitFeatures();
    cy.intercept('POST', '/api/v1/users/me/settings').as('saveSettings');

    SettingsPage.getFeatureWishlistCheckbox().uncheck();
    cy.wait('@saveSettings').its('response.statusCode').should('eq', 200);

    cy.window().should((win) => {
      expect(win.sessionStorage.getItem('CT.CollectionFeaturePreferences')).to.contain('"wishlist":false');
      expect(win.localStorage.getItem('CT.CollectionFeaturePreferences')).to.eq(null);
    });
  });
});

describe('Settings - manage tracker data page', () => {
  beforeEach(() => {
    cy.autoLogin();
    SettingsPage.visitManageTrackerData();
  });

  it('shows the mark-all-completed button', () => {
    SettingsPage.getMarkAllCompletedButton().should('be.visible');
  });

  it('shows the mark-all-uncompleted button', () => {
    SettingsPage.getMarkAllUncompletedButton().should('be.visible');
  });

  it('shows the mark-all-series-completed button', () => {
    SettingsPage.getMarkAllSeriesCompletedButton().should('be.visible');
  });

  it('shows the mark-all-series-uncompleted button', () => {
    SettingsPage.getMarkAllSeriesUncompletedButton().should('be.visible');
  });

  it('shows the mark-all-books-completed button', () => {
    SettingsPage.getMarkAllBooksCompletedButton().should('be.visible');
  });

  it('shows the mark-all-books-uncompleted button', () => {
    SettingsPage.getMarkAllBooksUncompletedButton().should('be.visible');
  });

  it('shows the remove-all-tracked-movie-data button', () => {
    SettingsPage.getRemoveAllTrackedMovieDataButton().should('be.visible');
  });

  it('shows the remove-all-tracked-series-data button', () => {
    SettingsPage.getRemoveAllTrackedSeriesDataButton().should('be.visible');
  });
});

describe('Settings - mark all completed / uncompleted', () => {
  beforeEach(() => {
    cy.autoLogin();
    cy.request('POST', '/api/v1/collection-items', buildCollectionItem('Watch Test Movie A', 'movie', 'tt8000001'));
    cy.request('POST', '/api/v1/collection-items', buildCollectionItem('Watch Test Movie B', 'movie', 'tt8000002'));
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Watch Test Series', 'series', 'tt8000003'),
    });
    cy.request('POST', '/api/v1/collection-items', buildBooksItem('Watch Test Book A', '9780132350884'));
    cy.request('POST', '/api/v1/collection-items', buildBooksItem('Watch Test Book B', '9780201633610'));
    // Force a full page reload so Angular reboots and its boot-time loadCollection()
    // picks up the seeded items. Mark-all actions hit the API; reload keeps client
    // collection state in sync before navigating to settings.
    // Register the intercept AFTER cy.visit but BEFORE cy.reload — cy.reload clears
    // the page and reboots Angular, which then fires items request with the seeded items.
    cy.visit('/client/#/collection/library');
    cy.intercept('GET', '/api/v1/collection-items*').as('collectionLoad');
    cy.reload();
    cy.wait('@collectionLoad');
    // Navigate to manage tracker data page
    SettingsPage.visitManageTrackerData();
  });

  it('marks all movies as completed and persists them in tracking', () => {
    cy.intercept('POST', '/api/v1/collection-items/actions/mark-movies-completed').as('markAllCompleted');
    cy.on('window:confirm', () => true);

    SettingsPage.getMarkAllCompletedButton().click();

    cy.wait('@markAllCompleted').its('response.statusCode').should('eq', 200);

    CollectionPage.visitTracking();
    CollectionPage.getListItems().should('have.length', 2);
    CollectionPage.getListItems()
      .should('contain.text', 'Watch Test Movie A')
      .and('contain.text', 'Watch Test Movie B');
    CollectionPage.getTrackingCompletedBadges().should('have.length', 2);
  });

  it('marks all movies as uncompleted and removes them from tracking', () => {
    cy.on('window:confirm', () => true);
    cy.intercept('POST', '/api/v1/collection-items/actions/mark-movies-completed').as('markAllCompleted');
    cy.intercept('POST', '/api/v1/collection-items/actions/mark-movies-uncompleted').as('markAllUncompleted');

    // First mark all as completed so there are items to uncomplete
    SettingsPage.getMarkAllCompletedButton().click();
    cy.wait('@markAllCompleted').its('response.statusCode').should('eq', 200);

    SettingsPage.getMarkAllUncompletedButton().click();
    cy.wait('@markAllUncompleted').its('response.statusCode').should('eq', 200);

    CollectionPage.visitTracking();
    CollectionPage.getEmptyState().should('be.visible');
  });

  it('mark all series as completed calls the bulk update API', () => {
    cy.intercept('POST', '/api/v1/collection-items/actions/mark-series-completed').as('markAllSeriesCompleted');
    cy.on('window:confirm', () => true);

    SettingsPage.getMarkAllSeriesCompletedButton().click();

    cy.wait('@markAllSeriesCompleted').its('response.statusCode').should('eq', 200);
  });

  it('mark all series as uncompleted calls the bulk update API', () => {
    cy.on('window:confirm', () => true);
    cy.intercept('POST', '/api/v1/collection-items/actions/mark-series-completed').as('markAllSeriesCompleted');
    cy.intercept('POST', '/api/v1/collection-items/actions/mark-series-uncompleted').as('markAllSeriesUncompleted');

    SettingsPage.getMarkAllSeriesCompletedButton().click();
    cy.wait('@markAllSeriesCompleted').its('response.statusCode').should('eq', 200);

    SettingsPage.getMarkAllSeriesUncompletedButton().click();
    cy.wait('@markAllSeriesUncompleted').its('response.statusCode').should('eq', 200);
  });

  it('marks all books as completed and persists them in tracking', () => {
    cy.intercept('POST', '/api/v1/collection-items/actions/mark-books-completed').as('markAllBooksCompleted');
    cy.on('window:confirm', () => true);

    SettingsPage.getMarkAllBooksCompletedButton().click();

    cy.wait('@markAllBooksCompleted').its('response.statusCode').should('eq', 200);

    CollectionPage.visitTracking();
    CollectionPage.getListItems().should('contain.text', 'Watch Test Book A').and('contain.text', 'Watch Test Book B');
    CollectionPage.getTrackingCompletedBadges().should('have.length.at.least', 2);
  });

  it('marks all books as uncompleted and keeps tracking items without completed badges', () => {
    cy.on('window:confirm', () => true);
    cy.intercept('POST', '/api/v1/collection-items/actions/mark-books-completed').as('markAllBooksCompleted');
    cy.intercept('POST', '/api/v1/collection-items/actions/mark-books-uncompleted').as('markAllBooksUncompleted');

    SettingsPage.getMarkAllBooksCompletedButton().click();
    cy.wait('@markAllBooksCompleted').its('response.statusCode').should('eq', 200);

    SettingsPage.getMarkAllBooksUncompletedButton().click();
    cy.wait('@markAllBooksUncompleted').its('response.statusCode').should('eq', 200);

    CollectionPage.visitTracking();
    CollectionPage.getListItems().should('contain.text', 'Watch Test Book A').and('contain.text', 'Watch Test Book B');
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getCollectionFilterButton('completed').click();
    CollectionPage.getEmptyState().should('be.visible');
  });

  it('remove all tracked movie data calls the delete API and empties the tracker', () => {
    cy.intercept('DELETE', '/api/v1/collection-items/tracking/completed-movies').as('deleteCompletedMovies');
    cy.on('window:confirm', () => true);

    // Seed a tracking item
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Tracked Movie', 'movie', 'tt8000004'),
      listType: 'tracking',
    });

    SettingsPage.getRemoveAllTrackedMovieDataButton().click();

    cy.wait('@deleteCompletedMovies').its('response.statusCode').should('eq', 200);

    CollectionPage.visitTracking();
    CollectionPage.getEmptyState().should('be.visible');
  });

  it('removes all tracked series data and persists an empty tracking', () => {
    cy.intercept('DELETE', '/api/v1/collection-items/tracking').as('deleteTracking');
    cy.on('window:confirm', () => true);

    // Seed a tracking item
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Tracked Series', 'series', 'tt8000005'),
      listType: 'tracking',
    });
    CollectionPage.visitTracking();
    CollectionPage.getListItems().should('have.length', 1).and('contain.text', 'Tracked Series');

    SettingsPage.visitManageTrackerData();

    SettingsPage.getRemoveAllTrackedSeriesDataButton().click();

    cy.wait('@deleteTracking').its('response.statusCode').should('eq', 200);

    CollectionPage.visitTracking();
    CollectionPage.getEmptyState().should('be.visible');
  });
});

describe('Settings - save changes', () => {
  beforeEach(() => {
    cy.autoLogin();
    openSettingsSections();
    SettingsPage.visitBasics();
  });

  it('calls POST /api/v1/users/me/settings when a setting changes', () => {
    cy.intercept('POST', '/api/v1/users/me/settings').as('saveSettings');

    SettingsPage.getThemeSelect()
      .find('option')
      .then(($options) => {
        const currentValue = $options.filter(':selected').val() as string;
        const otherOption = $options.toArray().find((option) => option.getAttribute('value') !== currentValue);

        if (otherOption) {
          SettingsPage.getThemeSelect().select(otherOption.getAttribute('value') as string);
          cy.wait('@saveSettings').its('response.statusCode').should('eq', 200);
        }
      });
  });

  it('persists a changed theme after it changes', () => {
    cy.intercept('POST', '/api/v1/users/me/settings').as('saveSettings');

    SettingsPage.getThemeSelect()
      .find('option')
      .then(($options) => {
        const currentValue = $options.filter(':selected').val() as string;
        const otherOption = $options.toArray().find((option) => option.getAttribute('value') !== currentValue);

        if (otherOption) {
          const newValue = otherOption.getAttribute('value') as string;
          SettingsPage.getThemeSelect().select(newValue);

          cy.wait('@saveSettings').its('request.body.theme').should('eq', newValue);
        }
      });
  });
});

describe('Settings - navigate to settings via menu', () => {
  beforeEach(() => {
    cy.autoLogin();
    openSettingsSections();
  });

  it('opens the settings page from the navigation menu', () => {
    CommonPage.navigateToSettingsViaMenu();
    cy.url().should('include', '#/settings');
    SettingsPage.getBasicsForm().should('be.visible');
  });
});

describe('Settings - account actions', () => {
  beforeEach(() => {
    cy.autoLogin();
    SettingsPage.visitAccount();
  });

  it('shows the account actions section', () => {
    SettingsPage.getAccountActionsSection().should('exist');
  });
});

describe('Settings - account actions (destructive)', () => {
  beforeEach(() => {
    // Use a fresh user - these tests are destructive (token rotation, user deletion).
    // Using the shared cypress user here would rotate/delete it and break all subsequent tests.
    cy.autoLoginWithNewUser();
    SettingsPage.visitAccount();
  });

  it('create new user token calls PUT /api/v1/users/me/token and shows the token dialog', () => {
    cy.intercept('PUT', '/api/v1/users/me/token').as('changeToken');
    cy.on('window:confirm', () => true);

    SettingsPage.getCreateUserTokenButton().click();

    cy.wait('@changeToken').its('response.statusCode').should('eq', 200);
    SettingsPage.getTokenDialogValue().should('be.visible').and('not.be.empty');
  });

  it('delete user calls DELETE /api/v1/users/me and redirects to login', () => {
    cy.intercept('DELETE', '/api/v1/users/me').as('deleteUser');
    cy.on('window:confirm', () => true);

    SettingsPage.getDeleteUserButton().click();

    cy.wait('@deleteUser').its('response.statusCode').should('eq', 204);
    cy.url().should('include', '/login/');
  });
});

describe('Settings - access tokens', () => {
  beforeEach(() => {
    cy.autoLogin();
    SettingsPage.visitAccessTokens();
  });

  it('shows the access tokens section', () => {
    SettingsPage.getAccessTokensSection().should('exist');
  });

  it('create access token calls POST /api/v1/users/me/access-tokens and shows the token dialog', () => {
    cy.intercept('POST', '/api/v1/users/me/access-tokens').as('createToken');
    cy.on('window:confirm', () => true);

    SettingsPage.getCreateAccessTokenButton().click();

    cy.wait('@createToken').its('response.statusCode').should('eq', 200);
    SettingsPage.getTokenDialogValue().should('be.visible').and('not.be.empty');
  });

  it('revoke access token calls DELETE /api/v1/users/me/access-tokens/:hash', () => {
    cy.intercept('DELETE', '/api/v1/users/me/access-tokens/*').as('revokeToken');
    cy.on('window:confirm', () => true);

    // Create a token first so there is one to revoke, then fetch the token list
    // to get the tokenHash (the create response only returns the raw token, not the hash).
    cy.intercept('POST', '/api/v1/users/me/access-tokens').as('createToken');
    SettingsPage.getCreateAccessTokenButton().click();
    cy.wait('@createToken').its('response.statusCode').should('eq', 200);

    // Close the dialog
    CollectionPage.closeActiveDialogByOverlay();

    // Fetch the token list to get the stored tokenHash
    cy.request('GET', '/api/v1/users/me/access-tokens').then((response) => {
      const tokenHash = (response.body.data as Array<{ tokenHash: string }>)[0].tokenHash;
      SettingsPage.getRevokeTokenButton(tokenHash).click();
      cy.wait('@revokeToken').its('response.statusCode').should('eq', 204);
    });
  });
});

describe('Settings - appMode: full (all permissions)', () => {
  beforeEach(() => {
    cy.autoLogin();
    cy.request('POST', '/api/v1/collection-items', buildCollectionItem('Full Mode Movie', 'movie', 'tt8300001'));
    CollectionPage.visit();
  });

  it('the add-new float button is visible', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAddNewButton().should('be.visible');
  });

  it('the item dialog shows edit, delete, and mark-watched buttons', () => {
    CollectionPage.getListItemImages().first().click();

    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogEditButton().should('be.visible');
    CollectionPage.getItemDialogDeleteButton().should('be.visible');
    CollectionPage.getItemDialogMarkFinishedButton().should('be.visible');
  });
});
