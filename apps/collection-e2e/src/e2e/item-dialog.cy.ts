import { buildCollectionItem } from '../fixtures/collection-item';
import { CollectionPage } from '../page-objects/collection.po';

describe('Item dialog — edit flow', () => {
  beforeEach(() => {
    cy.autoLogin();
    cy.request('POST', '/api/v1/create', buildCollectionItem('Edit Test Movie', 'movie', 'tt7000001'));
    CollectionPage.visit();
  });

  it('edits the title of an existing item and persists the change', () => {
    cy.intercept('PUT', '/api/v1/change/*').as('updateItem');
    cy.on('window:confirm', () => true);

    // Open the item dialog
    CollectionPage.getListItemImages().first().click();

    // Enter edit mode
    CollectionPage.getItemDialogEditButton().click();

    // Change the title
    CollectionPage.getItemDialogTitleInput().clear().type('Updated Title');

    // Save changes
    CollectionPage.getItemDialogSaveButton().click();

    cy.wait('@updateItem').its('response.statusCode').should('eq', 200);

    // Verify the dialog shows the updated title in read-only mode
    CollectionPage.getItemDialogTitleInput().should('not.exist');
    cy.contains('Updated Title').should('be.visible');

    // Close dialog and verify list shows updated title
    cy.get('.dialog-overlay').click({ force: true });
    CollectionPage.getListItems().should('contain.text', 'Updated Title');
  });

  it('edits multiple fields and persists the changes', () => {
    cy.intercept('PUT', '/api/v1/change/*').as('updateItem');
    cy.on('window:confirm', () => true);

    CollectionPage.getListItemImages().first().click();
    CollectionPage.getItemDialogEditButton().click();

    CollectionPage.getItemDialogYearInput().clear().type('2025');
    CollectionPage.getItemDialogGenreInput().clear().type('Drama, Comedy');
    CollectionPage.getItemDialogTagsInput().clear().type('#movie #updated');
    CollectionPage.getItemDialogActorsInput().clear().type('New Actor One, New Actor Two');
    CollectionPage.getItemDialogPlotInput().clear().type('An updated plot for testing.');

    CollectionPage.getItemDialogSaveButton().click();
    cy.wait('@updateItem').its('response.statusCode').should('eq', 200);

    // Verify persisted values in read-only mode
    cy.contains('2025').should('be.visible');
    cy.contains('Drama').should('be.visible');
    cy.contains('Comedy').should('be.visible');
    cy.contains('#updated').should('be.visible');
    cy.contains('New Actor One, New Actor Two').should('be.visible');
    cy.contains('An updated plot for testing.').should('be.visible');
  });

  it('discards draft changes when read-only is clicked', () => {
    cy.on('window:confirm', () => true);

    CollectionPage.getListItemImages().first().click();
    CollectionPage.getItemDialogEditButton().click();

    CollectionPage.getItemDialogTitleInput().clear().type('Discarded Title');

    // Click read-only to discard
    cy.getByTestId('item-dialog-read-only').click();

    // Verify original title remains and discarded title is gone
    cy.contains('Edit Test Movie').should('be.visible');
    cy.contains('Discarded Title').should('not.exist');
  });
});

describe('Item dialog — external links', () => {
  beforeEach(() => {
    cy.autoLogin();
    cy.request('POST', '/api/v1/create', buildCollectionItem('Link Test Movie', 'movie', 'tt7000003'));
    CollectionPage.visit();
  });

  it('shows the YouTube trailer link with the correct href', () => {
    CollectionPage.getListItemImages().first().click();

    cy.getByTestId('video')
      .should('have.attr', 'href')
      .and('include', 'youtube.com')
      .and('include', 'Link%20Test%20Movie');
  });

  it('shows the web search link with the correct href', () => {
    CollectionPage.getListItemImages().first().click();

    cy.getByTestId('about-web-search-link')
      .should('have.attr', 'href')
      .and('include', 'duckduckgo.com')
      .and('include', 'Link%20Test%20Movie');
  });
});

describe('Item dialog — mark watched / unwatched', () => {
  beforeEach(() => {
    cy.autoLogin();
    cy.request('POST', '/api/v1/create', buildCollectionItem('Watch Test Movie', 'movie', 'tt7000002'));
    CollectionPage.visit();
  });

  it('marks an unwatched item as watched', () => {
    cy.intercept('PUT', '/api/v1/change/*').as('updateItem');
    cy.on('window:confirm', () => true);

    CollectionPage.getListItemImages().first().click();

    CollectionPage.getItemDialogMarkWatchedButton().click();
    cy.wait('@updateItem').its('response.statusCode').should('eq', 200);

    // After marking watched, the button should switch to mark-unwatched
    CollectionPage.getItemDialogMarkUnwatchedButton().should('be.visible');
  });

  it('marks a watched item as unwatched', () => {
    cy.intercept('PUT', '/api/v1/change/*').as('updateItem');
    cy.on('window:confirm', () => true);

    // First mark as watched
    CollectionPage.getListItemImages().first().click();
    CollectionPage.getItemDialogMarkWatchedButton().click();
    cy.wait('@updateItem');

    // Now mark as unwatched
    CollectionPage.getItemDialogMarkUnwatchedButton().click();
    cy.wait('@updateItem').its('response.statusCode').should('eq', 200);

    // Button should switch back to mark-watched
    CollectionPage.getItemDialogMarkWatchedButton().should('be.visible');
  });
});
