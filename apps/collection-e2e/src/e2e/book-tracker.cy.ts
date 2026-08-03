import { buildBookTrackerItem, buildOpenLibraryItem, buildOpenLibrarySearchResult } from '../fixtures/openlibrary';
import { BookTrackerPage } from '../page-objects/book-tracker.po';
import { CommonPage } from '../page-objects/common.po';
import { SettingsPage } from '../page-objects/settings.po';

describe('Book tracker', () => {
  beforeEach(() => {
    cy.autoLogin();
  });

  it('toggles book tracker navigation while keeping the direct route accessible', () => {
    CommonPage.openMenu();
    CommonPage.getNavBookTrackerLink().should('be.visible');
    CommonPage.closeMenu();

    SettingsPage.visitFeatures();
    cy.intercept('POST', '/api/v1/user/settings').as('saveSettings');
    SettingsPage.getFeatureBookTrackerCheckbox().uncheck();
    cy.wait('@saveSettings').its('response.statusCode').should('eq', 200);

    CommonPage.openMenu();
    CommonPage.getMenuNavItem('nav-book-tracker').should('not.exist');
    CommonPage.closeMenu();

    BookTrackerPage.visit();
    cy.url().should('include', '#/collection/book-tracker');
    BookTrackerPage.getEmptyState().should('be.visible');

    SettingsPage.visitFeatures();
    SettingsPage.getFeatureBookTrackerCheckbox().check();
    cy.wait('@saveSettings').its('response.statusCode').should('eq', 200);
    CommonPage.openMenu();
    CommonPage.getNavBookTrackerLink().should('be.visible');
  });

  it('searches Open Library, creates a book, shows its details, and deletes it', () => {
    const title = 'The E2E Book';
    const isbn = '9780306406157';
    cy.intercept('GET', '/api/v1/proxy/external-metadata/search*provider=openlibrary*', {
      statusCode: 200,
      body: buildOpenLibrarySearchResult(title, isbn),
    }).as('openLibrarySearch');
    cy.intercept('GET', '/api/v1/proxy/external-metadata/item*externalIdentitySource=openlibrary*', {
      statusCode: 200,
      body: buildOpenLibraryItem(title, isbn),
    }).as('openLibraryItem');
    cy.intercept('POST', '/api/v1/create').as('createBook');
    cy.intercept('DELETE', '/api/v1/items/**').as('deleteBook');

    CommonPage.openMenu();
    CommonPage.getNavBookTrackerLink().click();
    BookTrackerPage.getAddFirstItemLink().click();
    BookTrackerPage.getNewItemSearchInput().type(title);
    cy.wait('@openLibrarySearch');
    BookTrackerPage.getNewItemContentOptions().should('have.length', 1).and('contain.text', title);
    BookTrackerPage.getNewItemSaveAndCloseButton().click();
    cy.wait('@openLibraryItem');
    cy.wait('@createBook').then(({ request, response }) => {
      expect(request.body).to.deep.include({
        title,
        contentType: 'book',
        externalProvider: 'openlibrary',
        externalItemId: isbn,
        listType: 'book-tracker',
        actors: 'Author One, Author Two',
      });
      expect(request.body.externalIds).to.deep.equal([{ source: 'isbn', id: isbn }]);
      expect(response?.statusCode).to.equal(200);
    });

    BookTrackerPage.getListItemTitles().should('have.length', 1).and('contain.text', title);
    BookTrackerPage.getListItemImages().first().click();
    BookTrackerPage.getItemDialog().should('contain.text', title).and('contain.text', 'Author One, Author Two');
    BookTrackerPage.getItemDialogIsbn().should('contain.text', isbn);

    cy.on('window:confirm', () => true);
    BookTrackerPage.getItemDialogDeleteButton().click();
    cy.wait('@deleteBook').its('response.statusCode').should('eq', 204);
    BookTrackerPage.getEmptyState().should('be.visible');
  });

  it('clears all book tracker data from manage tracker data settings', () => {
    cy.request('POST', '/api/v1/create', buildBookTrackerItem('Book To Clear'));
    cy.intercept('DELETE', '/api/v1/book-tracker').as('clearBookTracker');
    cy.on('window:confirm', () => true);

    SettingsPage.visitManageTrackerData();
    SettingsPage.getRemoveAllTrackedBookDataButton().click();
    cy.wait('@clearBookTracker').its('response.statusCode').should('eq', 200);

    BookTrackerPage.visit();
    BookTrackerPage.getEmptyState().should('be.visible');
  });
});
