import { buildCollectionItem } from '../fixtures/collection-item';
import { CollectionPage } from '../page-objects/collection.po';

/** Seeds items and reloads the collection page so the store is populated. */
const seedAndVisit = (items: ReturnType<typeof buildCollectionItem>[]) => {
  items.forEach((item) => {
    cy.request('POST', '/api/v1/create', item);
  });
  CollectionPage.visit();
};

describe('AI search - floating button', () => {
  beforeEach(() => {
    cy.autoLogin();
    cy.intercept('GET', '/api/v1/proxy/ai/available', { statusCode: 200, body: { aiAvailable: true } }).as(
      'aiAvailable'
    );
  });

  it('shows the AI search button in the float bar', () => {
    CollectionPage.getAiSearchButton().should('be.visible');
  });

  it('keeps standard search available alongside AI search', () => {
    CollectionPage.getAiSearchButton().should('be.visible');
    CollectionPage.getSearchInput().should('be.visible');
  });

  it('opens the AI search dialog from the floating button', () => {
    CollectionPage.openAiSearchDialog();
    CollectionPage.getAiSearchTextarea().should('be.visible');
  });
});

describe('AI search - input interaction', () => {
  beforeEach(() => {
    cy.autoLogin();
    cy.intercept('GET', '/api/v1/proxy/ai/available', { statusCode: 200, body: { aiAvailable: true } }).as(
      'aiAvailable'
    );
  });

  it('opens the AI search dialog when the AI button is clicked', () => {
    CollectionPage.openAiSearchDialog();
    CollectionPage.getAiSearchTextarea().should('be.visible');
    CollectionPage.getAiSearchSendButton().should('be.visible');
  });

  it('closes the dialog when send is clicked', () => {
    cy.intercept('POST', '/api/v1/proxy/ai/query', { statusCode: 200, body: { matchedIds: [] } }).as('aiQuery');
    CollectionPage.openAiSearchDialog();
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
  });

  it('filters the list to only matched items when AI returns IDs', () => {
    cy.intercept('POST', '/api/v1/proxy/ai/query', {
      statusCode: 200,
      body: { matchedIds: ['tt1000001'] },
    }).as('aiQuery');
    cy.intercept('POST', '/api/v1/items/matched').as('matchedItems');

    CollectionPage.openAiSearchDialog();
    CollectionPage.getAiSearchTextarea().type('sci-fi movies');
    CollectionPage.getAiSearchSendButton().click();

    cy.wait('@aiQuery');
    cy.wait('@matchedItems');
    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItems().first().should('contain.text', 'Sci-Fi Alpha');
  });

  it('shows the empty state when AI returns no matched IDs', () => {
    cy.intercept('POST', '/api/v1/proxy/ai/query', {
      statusCode: 200,
      body: { matchedIds: [] },
    }).as('aiQuery');
    cy.intercept('POST', '/api/v1/items/matched').as('matchedItems');

    CollectionPage.openAiSearchDialog();
    CollectionPage.getAiSearchTextarea().type('something that matches nothing');
    CollectionPage.getAiSearchSendButton().click();

    cy.wait('@aiQuery');
    cy.wait('@matchedItems');
    CollectionPage.getEmptyState().should('be.visible');
  });

  it('shows all items when the prompt is empty (no search sent)', () => {
    CollectionPage.getAllItems().should('have.length', 3);
  });

  it('sends the prompt text and library listType to the AI proxy endpoint', () => {
    cy.intercept('POST', '/api/v1/proxy/ai/query', {
      statusCode: 200,
      body: { matchedIds: [] },
    }).as('aiQuery');

    CollectionPage.openAiSearchDialog();
    CollectionPage.getAiSearchTextarea().type('show me action films');
    CollectionPage.getAiSearchSendButton().click();

    cy.wait('@aiQuery')
      .its('request.body')
      .should('deep.equal', { prompt: 'show me action films', listType: 'library' });
  });
});

describe('AI search - watchlist list', () => {
  const movieA = buildCollectionItem('Sci-Fi Alpha', 'movie', 'tt2000001');

  beforeEach(() => {
    cy.autoLogin();
    cy.intercept('GET', '/api/v1/proxy/ai/available', { statusCode: 200, body: { aiAvailable: true } }).as(
      'aiAvailable'
    );
    cy.request('POST', '/api/v1/create?listType=watchlist', movieA);
    CollectionPage.visitWatchlist();
  });

  it('shows the AI button and sends watchlist listType', () => {
    cy.intercept('POST', '/api/v1/proxy/ai/query', {
      statusCode: 200,
      body: { matchedIds: ['tt2000001'] },
    }).as('aiQuery');

    CollectionPage.getAiSearchButton().should('be.visible');
    CollectionPage.openAiSearchDialog();
    CollectionPage.getAiSearchTextarea().type('sci-fi');
    CollectionPage.getAiSearchSendButton().click();

    cy.wait('@aiQuery')
      .its('request.body')
      .should('deep.equal', { prompt: 'sci-fi', listType: 'watchlist' });
  });
});
