import { buildCollectionItem } from '../fixtures/collection-item';
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
    cy.intercept('POST', '/api/v1/items/refresh-images').as('refreshImages');
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
    cy.request('POST', '/api/v1/create', {
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
    cy.intercept('POST', '/api/v1/user/settings').as('saveSettings');

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

describe('Settings - manage tracker data page', () => {
  beforeEach(() => {
    cy.autoLogin();
    SettingsPage.visitManageTrackerData();
  });

  it('shows the mark-all-watched button', () => {
    SettingsPage.getMarkAllWatchedButton().should('be.visible');
  });

  it('shows the mark-all-unwatched button', () => {
    SettingsPage.getMarkAllUnwatchedButton().should('be.visible');
  });

  it('shows the mark-all-series-watched button', () => {
    SettingsPage.getMarkAllSeriesWatchedButton().should('be.visible');
  });

  it('shows the mark-all-series-unwatched button', () => {
    SettingsPage.getMarkAllSeriesUnwatchedButton().should('be.visible');
  });

  it('shows the remove-all-tracked-movie-data button', () => {
    SettingsPage.getRemoveAllTrackedMovieDataButton().should('be.visible');
  });

  it('shows the remove-all-tracked-series-data button', () => {
    SettingsPage.getRemoveAllTrackedSeriesDataButton().should('be.visible');
  });
});

describe('Settings - mark all watched / unwatched', () => {
  beforeEach(() => {
    cy.autoLogin();
    cy.request('POST', '/api/v1/create', buildCollectionItem('Watch Test Movie A', 'movie', 'tt8000001'));
    cy.request('POST', '/api/v1/create', buildCollectionItem('Watch Test Movie B', 'movie', 'tt8000002'));
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem('Watch Test Series', 'series', 'tt8000003'),
    });
    // Force a full page reload so Angular reboots and its boot-time loadCollection()
    // picks up the seeded items. ChangeWatchedStatusService reads from the in-memory
    // store, not the API — the store must contain the items before we act.
    // Register the intercept AFTER cy.visit but BEFORE cy.reload — cy.reload clears
    // the page and reboots Angular, which then fires items request with the seeded items.
    cy.visit('/client/#/collection/library');
    cy.intercept('GET', '/api/v1/items*').as('collectionLoad');
    cy.reload();
    cy.wait('@collectionLoad');
    // Navigate to manage tracker data page
    SettingsPage.visitManageTrackerData();
  });

  it('mark all movies as watched calls the bulk update API', () => {
    cy.intercept('POST', '/api/v1/items/mark-all-watched').as('markAllWatched');
    cy.on('window:confirm', () => true);

    SettingsPage.getMarkAllWatchedButton().click();

    cy.wait('@markAllWatched').its('response.statusCode').should('eq', 200);
  });

  it('mark all movies as unwatched calls the bulk update API', () => {
    cy.on('window:confirm', () => true);
    cy.intercept('POST', '/api/v1/items/mark-all-watched').as('markAllWatched');
    cy.intercept('POST', '/api/v1/items/mark-all-unwatched').as('markAllUnwatched');

    // First mark all as watched so there are watched items to unwatch
    SettingsPage.getMarkAllWatchedButton().click();
    cy.wait('@markAllWatched').its('response.statusCode').should('eq', 200);

    SettingsPage.getMarkAllUnwatchedButton().click();
    cy.wait('@markAllUnwatched').its('response.statusCode').should('eq', 200);
  });

  it('mark all series as watched calls the bulk update API', () => {
    cy.intercept('POST', '/api/v1/items/mark-all-series-watched').as('markAllSeriesWatched');
    cy.on('window:confirm', () => true);

    SettingsPage.getMarkAllSeriesWatchedButton().click();

    cy.wait('@markAllSeriesWatched').its('response.statusCode').should('eq', 200);
  });

  it('mark all series as unwatched calls the bulk update API', () => {
    cy.on('window:confirm', () => true);
    cy.intercept('POST', '/api/v1/items/mark-all-series-watched').as('markAllSeriesWatched');
    cy.intercept('POST', '/api/v1/items/mark-all-series-unwatched').as('markAllSeriesUnwatched');

    SettingsPage.getMarkAllSeriesWatchedButton().click();
    cy.wait('@markAllSeriesWatched').its('response.statusCode').should('eq', 200);

    SettingsPage.getMarkAllSeriesUnwatchedButton().click();
    cy.wait('@markAllSeriesUnwatched').its('response.statusCode').should('eq', 200);
  });

  it('remove all tracked movie data calls the delete API and empties the tracker', () => {
    cy.intercept('DELETE', '/api/v1/movie-tracker').as('deleteMovieTracker');
    cy.on('window:confirm', () => true);

    // Seed a movie tracker item
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem('Tracked Movie', 'movie', 'tt8000004'),
      listType: 'movie-tracker',
    });

    SettingsPage.getRemoveAllTrackedMovieDataButton().click();

    cy.wait('@deleteMovieTracker').its('response.statusCode').should('eq', 200);

    CollectionPage.visitMovieTracker();
    CollectionPage.getEmptyState().should('be.visible');
  });

  it('remove all tracked series data calls the delete API', () => {
    cy.intercept('DELETE', '/api/v1/series-tracker').as('deleteSeriesTracker');
    cy.on('window:confirm', () => true);

    // Seed a series tracker item
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem('Tracked Series', 'series', 'tt8000005'),
      listType: 'series-tracker',
    });

    SettingsPage.getRemoveAllTrackedSeriesDataButton().click();

    cy.wait('@deleteSeriesTracker').its('response.statusCode').should('eq', 200);
  });
});

describe('Settings - save changes', () => {
  beforeEach(() => {
    cy.autoLogin();
    openSettingsSections();
    SettingsPage.visitBasics();
  });

  it('calls POST /api/v1/user/settings when a setting changes', () => {
    cy.intercept('POST', '/api/v1/user/settings').as('saveSettings');

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
    cy.intercept('POST', '/api/v1/user/settings').as('saveSettings');

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

  it('create new user token calls PUT /api/v1/user/change-token and shows the token dialog', () => {
    cy.intercept('PUT', '/api/v1/user/change-token').as('changeToken');
    cy.on('window:confirm', () => true);

    SettingsPage.getCreateUserTokenButton().click();

    cy.wait('@changeToken').its('response.statusCode').should('eq', 200);
    SettingsPage.getTokenDialogValue().should('be.visible').and('not.be.empty');
  });

  it('delete user calls DELETE /api/v1/user and redirects to login', () => {
    cy.intercept('DELETE', '/api/v1/user').as('deleteUser');
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

  it('create access token calls POST /api/v1/user/access-token and shows the token dialog', () => {
    cy.intercept('POST', '/api/v1/user/access-token').as('createToken');
    cy.on('window:confirm', () => true);

    SettingsPage.getCreateAccessTokenButton().click();

    cy.wait('@createToken').its('response.statusCode').should('eq', 200);
    SettingsPage.getTokenDialogValue().should('be.visible').and('not.be.empty');
  });

  it('revoke access token calls DELETE /api/v1/user/access-token/:hash', () => {
    cy.intercept('DELETE', '/api/v1/user/access-token/*').as('revokeToken');
    cy.on('window:confirm', () => true);

    // Create a token first so there is one to revoke, then fetch the token list
    // to get the tokenHash (the create response only returns the raw token, not the hash).
    cy.intercept('POST', '/api/v1/user/access-token').as('createToken');
    SettingsPage.getCreateAccessTokenButton().click();
    cy.wait('@createToken').its('response.statusCode').should('eq', 200);

    // Close the dialog
    CollectionPage.closeActiveDialogByOverlay();

    // Fetch the token list to get the stored tokenHash
    cy.request('GET', '/api/v1/user/access-tokens').then((response) => {
      const tokenHash = (response.body as Array<{ tokenHash: string }>)[0].tokenHash;
      SettingsPage.getRevokeTokenButton(tokenHash).click();
      cy.wait('@revokeToken').its('response.statusCode').should('eq', 204);
    });
  });
});

describe('Settings - appMode: full (all permissions)', () => {
  beforeEach(() => {
    cy.autoLogin();
    cy.request('POST', '/api/v1/create', buildCollectionItem('Full Mode Movie', 'movie', 'tt8300001'));
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
    CollectionPage.getItemDialogMarkWatchedButton().should('be.visible');
  });
});
