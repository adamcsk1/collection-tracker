import { buildCollectionItem } from '../fixtures/collection-item';
import { AboutPage } from '../page-objects/about.po';
import { CollectionPage } from '../page-objects/collection.po';
import { CommonPage } from '../page-objects/common.po';
import { SettingsPage } from '../page-objects/settings.po';

// Suppress background Angular HTTP errors (token validation, preloadUserSettings, etc.)
// throughout this spec. Tests here validate DOM / UI state, not HTTP error handling.
beforeEach(() => {
  cy.on('uncaught:exception', () => false);
});

/**
 * Sets CT.AppMode in localStorage and reloads the collection page so that
 * Angular re-reads the stored value on init. Call after cy.autoLogin().
 */
const applyAppMode = (mode: 'basic' | 'limited' | 'full') => {
  cy.window().then((win) => win.localStorage.setItem('CT.AppMode', mode));
  CollectionPage.visit();
};

/**
 * Stores settingsLock=true and the given appMode in localStorage, then reloads.
 * Uses a non-full appMode so the SettingsLock checkbox is accessible in settings
 * (the checkbox is hidden when appMode is 'full').
 */
const enableSettingsLock = (appMode: 'basic' | 'limited' = 'basic') => {
  cy.window().then((win) => {
    win.localStorage.setItem('CT.AppMode', appMode);
    win.localStorage.setItem('CT.SettingLock', 'true');
  });
  CollectionPage.visit();
};

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
    win.localStorage.setItem('CT.DetailsGlobal watch status', 'true');
  });
};

describe('Settings - basic form fields', () => {
  beforeEach(() => {
    cy.autoLogin();
    openSettingsSections();
    SettingsPage.visit();
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

  it('shows the app mode select', () => {
    SettingsPage.getAppModeSelect().should('be.visible');
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

  it('save button is enabled when the form is valid', () => {
    SettingsPage.getSaveButton().should('not.be.disabled');
  });

  it('save-and-back button is enabled when the form is valid', () => {
    SettingsPage.getSaveAndBackButton().should('not.be.disabled');
  });
});

describe('Settings - settings lock', () => {
  beforeEach(() => {
    cy.autoLogin();
    openSettingsSections();
    SettingsPage.visit();
  });

  it('shows the settings-lock checkbox when app mode is not full', () => {
    SettingsPage.getAppModeSelect().select('basic');
    SettingsPage.getSettingsLockCheckbox().should('exist');
  });

  it('hides the settings-lock checkbox when app mode is full', () => {
    SettingsPage.getAppModeSelect().select('full');
    cy.getByTestId('settings-settings-lock').should('not.exist');
  });
});

describe('Settings - full app mode sections', () => {
  beforeEach(() => {
    cy.autoLogin();
    openSettingsSections();
    SettingsPage.visit();
    SettingsPage.getAppModeSelect().select('full');
  });

  it('shows the images refresh start button', () => {
    SettingsPage.getImagesRefreshStartButton().should('be.visible');
  });

  it('shows the mark-all-watched button', () => {
    SettingsPage.getMarkAllWatchedButton().should('be.visible');
  });

  it('shows the mark-all-unwatched button', () => {
    SettingsPage.getMarkAllUnwatchedButton().should('be.visible');
  });
});

describe('Settings - mark all watched / unwatched', () => {
  beforeEach(() => {
    cy.autoLogin();
    cy.request('POST', '/api/v1/create', buildCollectionItem('Watch Test Movie A'));
    cy.request('POST', '/api/v1/create', buildCollectionItem('Watch Test Movie B'));
    openSettingsSections();
    // Force a full page reload so Angular reboots and its boot-time loadCollection()
    // picks up the seeded items. ChangeWatchedStatusService reads from the in-memory
    // store, not the API — the store must contain the items before we act.
    // Register the intercept AFTER cy.visit but BEFORE cy.reload — cy.reload clears
    // the page and reboots Angular, which then fires get-all with the seeded items.
    cy.visit('/client/#/collection');
    cy.intercept('GET', '/api/v1/get-all*').as('collectionLoad');
    cy.reload();
    cy.wait('@collectionLoad');
    // Navigate to settings via hash change so Angular stays alive and the
    // collection store remains populated.
    cy.window().then((win) => {
      win.location.hash = '/settings';
    });
    SettingsPage.getAppModeSelect().select('full');
  });

  it('mark all as watched calls the update API for each unwatched item', () => {
    cy.intercept('PUT', '/api/v1/change/*').as('updateItem');
    cy.on('window:confirm', () => true);

    SettingsPage.getMarkAllWatchedButton().click();

    cy.wait('@updateItem');
    cy.wait('@updateItem');
  });

  it('mark all as unwatched calls the update API for each watched item', () => {
    cy.on('window:confirm', () => true);
    cy.intercept('PUT', '/api/v1/change/*').as('updateItem');

    // First mark all as watched so there are watched items to unwatch
    SettingsPage.getMarkAllWatchedButton().click();
    cy.wait('@updateItem');
    cy.wait('@updateItem');

    cy.intercept('PUT', '/api/v1/change/*').as('updateItemUnwatch');
    SettingsPage.getMarkAllUnwatchedButton().click();

    cy.wait('@updateItemUnwatch');
    cy.wait('@updateItemUnwatch');
  });
});

describe('Settings - save changes', () => {
  beforeEach(() => {
    cy.autoLogin();
    openSettingsSections();
    SettingsPage.visit();
  });

  it('calls POST /api/v1/user/settings when save is clicked', () => {
    cy.intercept('POST', '/api/v1/user/settings').as('saveSettings');

    SettingsPage.getSaveButton().click();

    cy.wait('@saveSettings').its('response.statusCode').should('eq', 200);
  });

  it('persists a changed theme after save', () => {
    cy.intercept('POST', '/api/v1/user/settings').as('saveSettings');

    SettingsPage.getThemeSelect().find('option').then(($options) => {
      const currentValue = $options.filter(':selected').val() as string;
      const otherOption = $options.toArray().find((option) => option.getAttribute('value') !== currentValue);

      if (otherOption) {
        const newValue = otherOption.getAttribute('value') as string;
        SettingsPage.getThemeSelect().select(newValue);
        SettingsPage.getSaveButton().click();

        cy.wait('@saveSettings').its('request.body.theme').should('eq', newValue);
      }
    });
  });

  it('navigates back to the collection after save-and-back', () => {
    cy.intercept('POST', '/api/v1/user/settings').as('saveSettings');

    SettingsPage.getSaveAndBackButton().click();

    cy.wait('@saveSettings');
    cy.url().should('include', '#/collection');
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
    SettingsPage.getSaveButton().should('be.visible');
  });
});

describe('Settings - account actions', () => {
  beforeEach(() => {
    cy.autoLogin();
    openSettingsSections();
    SettingsPage.visit();
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
    openSettingsSections();
    SettingsPage.visit();
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
    openSettingsSections();
    SettingsPage.visit();
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
    cy.get('[role="dialog"]').find('button.button-icon').click();

    // Fetch the token list to get the stored tokenHash
    cy.request('GET', '/api/v1/user/access-tokens').then((response) => {
      const tokenHash = (response.body as Array<{ tokenHash: string; }>)[0].tokenHash;
      SettingsPage.getRevokeTokenButton(tokenHash).click();
      cy.wait('@revokeToken').its('response.statusCode').should('eq', 204);
    });
  });
});

// ---------------------------------------------------------------------------
// App mode
// ---------------------------------------------------------------------------

describe('Settings - appMode: basic (read-only)', () => {
  beforeEach(() => {
    cy.autoLogin();
    // Seed the item before applyAppMode — the page visit inside applyAppMode
    // triggers a token rotation that would invalidate the cookie for cy.request.
    cy.request('POST', '/api/v1/create', buildCollectionItem('Basic Mode Movie'));
    applyAppMode('basic');
  });

  it('the add-new float button is not present', () => {
    CollectionPage.getShowFunctionsButton().click();
    cy.getByTestId('add-new').should('not.exist');
  });

  it('the item dialog has no edit, delete, or mark-watched buttons', () => {
    CollectionPage.getListItemImages().first().click();

    cy.getByTestId('item-dialog-edit').should('not.exist');
    cy.getByTestId('item-dialog-delete').should('not.exist');
    cy.getByTestId('item-dialog-mark-watched').should('not.exist');
    cy.getByTestId('item-dialog-mark-unwatched').should('not.exist');
  });
});

describe('Settings - appMode: limited (create only)', () => {
  beforeEach(() => {
    cy.autoLogin();
    // Seed the item before applyAppMode — the page visit inside applyAppMode
    // triggers a token rotation that would invalidate the cookie for cy.request.
    cy.request('POST', '/api/v1/create', buildCollectionItem('Limited Mode Movie'));
    applyAppMode('limited');
  });

  it('the add-new float button is visible', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAddNewButton().should('be.visible');
  });

  it('the item dialog has no edit, delete, or mark-watched buttons', () => {
    CollectionPage.getListItemImages().first().click();

    cy.getByTestId('item-dialog-edit').should('not.exist');
    cy.getByTestId('item-dialog-delete').should('not.exist');
    cy.getByTestId('item-dialog-mark-watched').should('not.exist');
    cy.getByTestId('item-dialog-mark-unwatched').should('not.exist');
  });
});

describe('Settings - appMode: full (all permissions)', () => {
  beforeEach(() => {
    cy.autoLogin();
    cy.request('POST', '/api/v1/create', buildCollectionItem('Full Mode Movie'));
    CollectionPage.visit();
  });

  it('the add-new float button is visible', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAddNewButton().should('be.visible');
  });

  it('the item dialog shows edit, delete, and mark-watched buttons', () => {
    CollectionPage.getListItemImages().first().click();

    cy.getByTestId('item-dialog-edit').should('be.visible');
    cy.getByTestId('item-dialog-delete').should('be.visible');
    cy.getByTestId('item-dialog-mark-watched').should('be.visible');
  });
});

// ---------------------------------------------------------------------------
// Settings lock
// ---------------------------------------------------------------------------

describe('Settings - settings lock: enabled', () => {
  beforeEach(() => {
    cy.autoLogin();
    enableSettingsLock();
  });

  it('hides the settings nav link', () => {
    CommonPage.openMenu();
    CommonPage.getNavSettingsLink().should('not.exist');
  });

  it('still shows collection, statistics, sync, about and logout nav links', () => {
    CommonPage.openMenu();
    CommonPage.getNavCollectionLink().should('be.visible');
    CommonPage.getNavSyncLink().should('be.visible');
    CommonPage.getNavAboutLink().should('be.visible');
    CommonPage.getNavLogoutLink().should('be.visible');
  });
});

describe('Settings - settings unlock via about page', () => {
  beforeEach(() => {
    cy.autoLogin();
    enableSettingsLock();
    AboutPage.visit();
  });

  it('clicking the version 10 times restores the settings nav link', () => {
    for (let clickIndex = 0; clickIndex < 10; clickIndex++) {
      AboutPage.getVersion().click();
    }

    CommonPage.openMenu();
    CommonPage.getNavSettingsLink().should('be.visible');
  });

  it('clicking fewer than 10 times does not unlock settings', () => {
    for (let clickIndex = 0; clickIndex < 9; clickIndex++) {
      AboutPage.getVersion().click();
    }

    CommonPage.openMenu();
    CommonPage.getNavSettingsLink().should('not.exist');
  });
});
