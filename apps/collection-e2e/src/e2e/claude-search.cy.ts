import { buildCollectionItem } from '../fixtures/collection-item';
import { CollectionPage } from '../page-objects/collection.po';

/** Seeds items and reloads the collection page so the store is populated. */
const seedAndVisit = (items: ReturnType<typeof buildCollectionItem>[]) => {
  items.forEach((item) => {
    cy.request('POST', '/api/v1/create', { name: item.name, content: item.content });
  });
  CollectionPage.visit();
};

// Always reset the Claude AI preference after each test so subsequent spec files
// start with standard search. CT.UseClaudeAi is NOT cleared by cy.autoLogin().
afterEach(() => {
  cy.window().then((win) => win.localStorage.removeItem('CT.UseClaudeAi'));
});

describe('Claude AI search — toggle', () => {
  beforeEach(() => {
    cy.autoLogin();
  });

  it('shows the Claude AI toggle button in the float buttons menu', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getClaudeAiToggleButton().should('be.visible');
  });

  it('switches to Claude AI input when toggle is clicked', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getClaudeAiToggleButton().click();
    CollectionPage.getClaudeAiTrigger().should('be.visible');
  });

  it('hides the standard search input when Claude AI is active', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getClaudeAiToggleButton().click();
    cy.getByTestId('collection-search').should('not.exist');
  });

  it('restores the standard search input when toggle is clicked again', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getClaudeAiToggleButton().click();
    CollectionPage.getClaudeAiTrigger().should('be.visible');

    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getClaudeAiToggleButton().click();
    CollectionPage.getSearchInput().should('be.visible');
    CollectionPage.getClaudeAiTrigger().should('not.exist');
  });

  it('persists the Claude AI preference in localStorage', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getClaudeAiToggleButton().click();

    cy.window().then((win) => {
      expect(win.localStorage.getItem('CT.UseClaudeAi')).to.equal('true');
    });
  });

  it('restores Claude AI input on page reload when preference was saved', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getClaudeAiToggleButton().click();

    CollectionPage.visit();
    CollectionPage.getClaudeAiTrigger().should('be.visible');
  });
});

describe('Claude AI search — input interaction', () => {
  beforeEach(() => {
    cy.autoLogin();
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getClaudeAiToggleButton().click();
  });

  it('expands the panel when the compact trigger is clicked', () => {
    CollectionPage.getClaudeAiTrigger().click();
    CollectionPage.getClaudeAiTextarea().should('be.visible');
    CollectionPage.getClaudeAiSendButton().should('be.visible');
  });

  it('collapses the panel when send is clicked', () => {
    cy.intercept('POST', '/api/v1/proxy/claude/query', { statusCode: 200, body: { matchedIds: [] } }).as(
      'claudeQuery',
    );
    CollectionPage.getClaudeAiTrigger().click();
    CollectionPage.getClaudeAiTextarea().type('any prompt');
    CollectionPage.getClaudeAiSendButton().click();
    CollectionPage.getClaudeAiSendButton().should('not.exist');
  });
});

describe('Claude AI search — filtering', () => {
  const movieA = buildCollectionItem('Sci-Fi Alpha', 'movie', 'tt1000001');
  const movieB = buildCollectionItem('Drama Beta', 'movie', 'tt1000002');
  const movieC = buildCollectionItem('Action Gamma', 'movie', 'tt1000003');

  beforeEach(() => {
    cy.autoLogin();
    seedAndVisit([movieA, movieB, movieC]);
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getClaudeAiToggleButton().click();
  });

  it('filters the list to only matched items when Claude returns IDs', () => {
    cy.intercept('POST', '/api/v1/proxy/claude/query', {
      statusCode: 200,
      body: { matchedIds: ['tt1000001'] },
    }).as('claudeQuery');

    CollectionPage.getClaudeAiTrigger().click();
    CollectionPage.getClaudeAiTextarea().type('sci-fi movies');
    CollectionPage.getClaudeAiSendButton().click();

    cy.wait('@claudeQuery');
    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItems().first().should('contain.text', 'Sci-Fi Alpha');
  });

  it('shows the empty state when Claude returns no matched IDs', () => {
    cy.intercept('POST', '/api/v1/proxy/claude/query', {
      statusCode: 200,
      body: { matchedIds: [] },
    }).as('claudeQuery');

    CollectionPage.getClaudeAiTrigger().click();
    CollectionPage.getClaudeAiTextarea().type('something that matches nothing');
    CollectionPage.getClaudeAiSendButton().click();

    cy.wait('@claudeQuery');
    CollectionPage.getEmptyState().should('be.visible');
  });

  it('shows all items when the prompt is empty (no search sent)', () => {
    CollectionPage.getAllItems().should('have.length', 3);
  });

  it('sends the prompt text to the Claude proxy endpoint', () => {
    cy.intercept('POST', '/api/v1/proxy/claude/query', {
      statusCode: 200,
      body: { matchedIds: [] },
    }).as('claudeQuery');

    CollectionPage.getClaudeAiTrigger().click();
    CollectionPage.getClaudeAiTextarea().type('show me action films');
    CollectionPage.getClaudeAiSendButton().click();

    cy.wait('@claudeQuery').its('request.body').should('deep.equal', { prompt: 'show me action films' });
  });
});
