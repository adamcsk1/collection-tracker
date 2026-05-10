import { buildCollectionItem } from '../fixtures/collection-item';
import { CollectionPage } from '../page-objects/collection.po';

/** Seeds items and reloads the collection page so the store is populated. */
const seedAndVisit = (items: ReturnType<typeof buildCollectionItem>[]) => {
  items.forEach((item) => {
    cy.request('POST', '/api/v1/create', item);
  });
  CollectionPage.visit();
};

// Always reset the AI search preference after each test so subsequent spec files
// start with standard search. CT.UseAiSearch is NOT cleared by cy.autoLogin().
afterEach(() => {
  cy.window().then((win) => win.localStorage.removeItem('CT.UseAiSearch'));
});

describe('AI search - toggle', () => {
  beforeEach(() => {
    cy.autoLogin();
    cy.intercept('GET', '/api/v1/proxy/ai/available', { statusCode: 200, body: { aiAvailable: true } }).as(
      'aiAvailable'
    );
  });

  it('shows the AI search toggle button in the float buttons menu', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAiSearchToggleButton().should('be.visible');
  });

  it('switches to AI search input when toggle is clicked', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAiSearchToggleButton().click();
    CollectionPage.getAiSearchTrigger().should('be.visible');
  });

  it('hides the standard search input when AI search is active', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAiSearchToggleButton().click();
    cy.getByTestId('collection-search').should('not.exist');
  });

  it('restores the standard search input when toggle is clicked again', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAiSearchToggleButton().click();
    CollectionPage.getAiSearchTrigger().should('be.visible');

    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAiSearchToggleButton().click();
    CollectionPage.getSearchInput().should('be.visible');
    CollectionPage.getAiSearchTrigger().should('not.exist');
  });

  it('persists the AI search preference in localStorage', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAiSearchToggleButton().click();

    cy.window().then((win) => {
      expect(win.localStorage.getItem('CT.UseAiSearch')).to.equal('true');
    });
  });

  it('restores AI search input on page reload when preference was saved', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAiSearchToggleButton().click();

    CollectionPage.visit();
    CollectionPage.getAiSearchTrigger().should('be.visible');
  });
});

describe('AI search - input interaction', () => {
  beforeEach(() => {
    cy.autoLogin();
    cy.intercept('GET', '/api/v1/proxy/ai/available', { statusCode: 200, body: { aiAvailable: true } }).as(
      'aiAvailable'
    );
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAiSearchToggleButton().click();
  });

  it('expands the panel when the compact trigger is clicked', () => {
    CollectionPage.getAiSearchTrigger().click();
    CollectionPage.getAiSearchTextarea().should('be.visible');
    CollectionPage.getAiSearchSendButton().should('be.visible');
  });

  it('collapses the panel when send is clicked', () => {
    cy.intercept('POST', '/api/v1/proxy/ai/query', { statusCode: 200, body: { matchedIds: [] } }).as('aiQuery');
    CollectionPage.getAiSearchTrigger().click();
    CollectionPage.getAiSearchTextarea().type('any prompt');
    CollectionPage.getAiSearchSendButton().click();
    CollectionPage.getAiSearchSendButton().should('not.exist');
  });
});

describe('AI search - filtering', () => {
  const movieA = buildCollectionItem('Sci-Fi Alpha', 'movie', 'tt1000001');
  const movieB = buildCollectionItem('Drama Beta', 'movie', 'tt1000002');
  const movieC = buildCollectionItem('Action Gamma', 'movie', 'tt1000003');

  beforeEach(() => {
    cy.autoLogin();
    cy.intercept('GET', '/api/v1/proxy/ai/available', { statusCode: 200, body: { aiAvailable: true } }).as(
      'aiAvailable'
    );
    seedAndVisit([movieA, movieB, movieC]);
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAiSearchToggleButton().click();
  });

  it('filters the list to only matched items when AI returns IDs', () => {
    cy.intercept('POST', '/api/v1/proxy/ai/query', {
      statusCode: 200,
      body: { matchedIds: ['tt1000001'] },
    }).as('aiQuery');

    CollectionPage.getAiSearchTrigger().click();
    CollectionPage.getAiSearchTextarea().type('sci-fi movies');
    CollectionPage.getAiSearchSendButton().click();

    cy.wait('@aiQuery');
    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItems().first().should('contain.text', 'Sci-Fi Alpha');
  });

  it('shows the empty state when AI returns no matched IDs', () => {
    cy.intercept('POST', '/api/v1/proxy/ai/query', {
      statusCode: 200,
      body: { matchedIds: [] },
    }).as('aiQuery');

    CollectionPage.getAiSearchTrigger().click();
    CollectionPage.getAiSearchTextarea().type('something that matches nothing');
    CollectionPage.getAiSearchSendButton().click();

    cy.wait('@aiQuery');
    CollectionPage.getEmptyState().should('be.visible');
  });

  it('shows all items when the prompt is empty (no search sent)', () => {
    CollectionPage.getAllItems().should('have.length', 3);
  });

  it('sends the prompt text to the AI proxy endpoint', () => {
    cy.intercept('POST', '/api/v1/proxy/ai/query', {
      statusCode: 200,
      body: { matchedIds: [] },
    }).as('aiQuery');

    CollectionPage.getAiSearchTrigger().click();
    CollectionPage.getAiSearchTextarea().type('show me action films');
    CollectionPage.getAiSearchSendButton().click();

    cy.wait('@aiQuery').its('request.body').should('deep.equal', { prompt: 'show me action films' });
  });
});
