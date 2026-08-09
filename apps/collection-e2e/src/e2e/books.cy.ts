import { buildBooksItem, buildOpenLibraryItem, buildOpenLibrarySearchResult } from '../fixtures/openlibrary';
import { BooksPage } from '../page-objects/books.po';
import { CollectionPage } from '../page-objects/collection.po';
import { CommonPage } from '../page-objects/common.po';
import { SettingsPage } from '../page-objects/settings.po';

describe('Books', () => {
  beforeEach(() => {
    cy.autoLogin();
  });

  it('toggles books filter while keeping the direct route accessible', () => {
    CollectionPage.visit();
    cy.getByTestId('show-functions').click();
    cy.getByTestId('collection-media-chip-book').should('be.visible');

    SettingsPage.visitFeatures();
    cy.intercept('POST', '/api/v1/users/me/settings').as('saveSettings');
    SettingsPage.getFeatureBooksCheckbox().uncheck();
    cy.wait('@saveSettings').its('response.statusCode').should('eq', 200);

    CollectionPage.visit();
    cy.getByTestId('collection-media-chip-book').should('not.exist');
    CommonPage.openMenu();
    CommonPage.getMenuNavItem('nav-books').should('not.exist');
    CommonPage.closeMenu();

    BooksPage.visit();
    cy.url().should('include', '#/collection/books');
    BooksPage.getEmptyState().should('be.visible');

    SettingsPage.visitFeatures();
    SettingsPage.getFeatureBooksCheckbox().check();
    cy.wait('@saveSettings').its('response.statusCode').should('eq', 200);
    CollectionPage.visit();
    cy.getByTestId('collection-media-chip-book').should('be.visible');
  });

  it('searches Open Library, creates a book, shows its details, and deletes it', () => {
    const title = 'The E2E Book';
    const isbn = '9780306406157';
    cy.intercept('GET', '/api/v1/external-metadata/search*provider=openlibrary*', {
      statusCode: 200,
      body: { data: buildOpenLibrarySearchResult(title, isbn) },
    }).as('openLibrarySearch');
    cy.intercept('GET', '/api/v1/external-metadata/items*externalIdentitySource=openlibrary*', {
      statusCode: 200,
      body: { data: buildOpenLibraryItem(title, isbn) },
    }).as('openLibraryItem');
    cy.intercept('POST', '/api/v1/collection-items').as('createBook');
    cy.intercept('DELETE', '/api/v1/collection-items/**').as('deleteBook');

    BooksPage.visit();
    BooksPage.getAddFirstItemLink().click();
    BooksPage.getNewItemSearchInput().type(title);
    cy.wait('@openLibrarySearch');
    BooksPage.getNewItemContentOptions().should('have.length', 1).and('contain.text', title);
    BooksPage.getNewItemSaveAndCloseButton().click();
    cy.wait('@openLibraryItem');
    cy.wait('@createBook').then(({ request, response }) => {
      expect(request.body).to.deep.include({
        title,
        contentType: 'book',
        externalProvider: 'openlibrary',
        externalItemId: isbn,
        listType: 'books',
        actors: 'Author One, Author Two',
      });
      expect(request.body.externalIds).to.deep.equal([{ source: 'isbn', id: isbn }]);
      expect(response?.statusCode).to.equal(200);
    });

    BooksPage.getListItemTitles().should('have.length', 1).and('contain.text', title);
    BooksPage.getListItemImages().first().click();
    BooksPage.getItemDialog().should('contain.text', title).and('contain.text', 'Author One, Author Two');
    BooksPage.getItemDialogIsbn().should('contain.text', isbn);

    cy.on('window:confirm', () => true);
    BooksPage.getItemDialogDeleteButton().click();
    cy.wait('@deleteBook').its('response.statusCode').should('eq', 204);
    BooksPage.getEmptyState().should('be.visible');
  });

  it('adds a books list item manually by ISBN and persists it after reload', () => {
    const title = 'Manual E2E Book';
    const isbn = '9780140328721';
    const authors = 'Manual Author';
    cy.intercept('POST', '/api/v1/collection-items').as('createManualBook');

    BooksPage.visit();
    BooksPage.getShowFunctionsButton().click();
    BooksPage.getAddNewButton().click();

    BooksPage.getNewItemManualModeButton().click();
    BooksPage.getNewItemManualTitleInput().type(title);
    BooksPage.getNewItemManualIsbnInput().type(isbn);
    BooksPage.getNewItemManualAuthorsInput().type(authors);
    BooksPage.getNewItemSaveAndCloseButton().should('be.enabled').click();

    cy.wait('@createManualBook').then(({ request, response }) => {
      expect(request.body).to.deep.include({
        title,
        contentType: 'book',
        externalProvider: 'openlibrary',
        externalItemId: isbn,
        listType: 'books',
        actors: authors,
        favorite: false,
      });
      expect(request.body.externalIds).to.deep.equal([{ source: 'isbn', id: isbn }]);
      expect(response?.statusCode).to.equal(200);
    });

    BooksPage.getListItemTitles().should('have.length', 1).and('contain.text', title);
    BooksPage.getListItemImages().first().click();
    BooksPage.getItemDialog().should('contain.text', title).and('contain.text', authors);
    BooksPage.getItemDialogIsbn().should('contain.text', isbn);

    cy.intercept('GET', '/api/v1/collection-items*').as('reloadBooks');
    cy.reload();
    cy.wait('@reloadBooks');
    BooksPage.getListItemTitles().should('have.length', 1).and('contain.text', title);
  });

  it('keeps manual book save disabled for invalid ISBN or missing required fields', () => {
    BooksPage.visit();
    BooksPage.getShowFunctionsButton().click();
    BooksPage.getAddNewButton().click();

    BooksPage.getNewItemManualModeButton().click();
    BooksPage.getNewItemManualTitleInput().type('Manual Book Title');
    BooksPage.getNewItemSaveAndCloseButton().should('be.disabled');

    BooksPage.getNewItemManualIsbnInput().type('not-an-isbn');
    BooksPage.getNewItemSaveAndCloseButton().should('be.disabled');

    BooksPage.getNewItemManualIsbnInput().clear().type('9780140328721');
    BooksPage.getNewItemSaveAndCloseButton().should('be.enabled');
  });

  it('clears all books list data from manage tracker data settings', () => {
    cy.request('POST', '/api/v1/collection-items', buildBooksItem('Book To Clear'));
    cy.intercept('DELETE', '/api/v1/collection-items/books').as('clearBooks');
    cy.on('window:confirm', () => true);

    SettingsPage.visitManageTrackerData();
    SettingsPage.getRemoveAllTrackedBookDataButton().click();
    cy.wait('@clearBooks').its('response.statusCode').should('eq', 200);

    BooksPage.visit();
    BooksPage.getEmptyState().should('be.visible');
  });
});
