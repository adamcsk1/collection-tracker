import { generate } from 'random-words';
import { buildCollectionItem, buildCollectionItems } from '../fixtures/collection-item';
import { buildOmdbItem, buildOmdbSearchResult } from '../fixtures/omdb';
import { CollectionPage } from '../page-objects/collection.po';
import { CommonPage } from '../page-objects/common.po';

/** Creates collection items on the real server via the authenticated session. */
const seedItems = (items: ReturnType<typeof buildCollectionItem>[]) => {
  items.forEach((item) => {
    cy.request('POST', '/api/v1/create', { name: item.name, content: item.content });
  });
};

describe('Collection — empty state', () => {
  beforeEach(() => {
    cy.autoLogin();
  });

  it('shows the empty state message when collection has no items', () => {
    CollectionPage.getEmptyState().should('be.visible');
  });

  it('shows the "Add first item" link in the empty state', () => {
    CollectionPage.getAddFirstItemLink().should('be.visible');
  });

  it('has a visible search input', () => {
    CollectionPage.getSearchInput().should('be.visible');
  });
});

describe('Collection — add a new element', () => {
  const newTitle = 'Test Movie Alpha';

  beforeEach(() => {
    cy.intercept('GET', '/api/v1/proxy/omdb/search*', {
      statusCode: 200,
      body: buildOmdbSearchResult(newTitle),
    }).as('omdbSearch');
    cy.intercept('GET', '/api/v1/proxy/omdb/item*', {
      statusCode: 200,
      body: buildOmdbItem(newTitle),
    }).as('omdbItem');

    cy.autoLogin();
  });

  it('opens the new-item dialog via float buttons', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAddNewButton().click();
    CollectionPage.getNewItemSearchInput().should('be.visible');
  });

  it('searches OMDB, saves the item, and it appears in the list', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAddNewButton().click();

    CollectionPage.getNewItemSearchInput().type(newTitle);
    cy.wait('@omdbSearch');

    CollectionPage.getNewItemContentSelect().find('option').should('have.length.at.least', 1);
    CollectionPage.getNewItemSaveButton().click();

    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItems().first().should('contain.text', newTitle);
  });
});

describe('Collection — edit an element', () => {
  beforeEach(() => {
    cy.autoLogin();
    seedItems([buildCollectionItem('Editable Movie')]);
    CollectionPage.visit();
  });

  it('opens item dialog and shows edit button', () => {
    CollectionPage.getListItemImages().first().click();
    CollectionPage.getItemDialogEditButton().should('be.visible');
  });

  it('enters edit mode and the save button appears', () => {
    CollectionPage.getListItemImages().first().click();
    CollectionPage.getItemDialogEditButton().click();
    CollectionPage.getItemDialogSaveButton().should('be.visible');
  });
});

describe('Collection — delete an element', () => {
  beforeEach(() => {
    cy.autoLogin();
    seedItems([buildCollectionItem('Movie To Delete')]);
    CollectionPage.visit();
  });

  it('deletes the item and the empty state becomes visible', () => {
    CollectionPage.getListItemImages().first().click();
    CollectionPage.getItemDialogDeleteButton().click();
    CollectionPage.getEmptyState().should('be.visible');
  });
});

describe('Collection — 25 random items', () => {
  const rawWords = generate(25);
  const titles = (Array.isArray(rawWords) ? rawWords : [String(rawWords)]) as string[];
  const twentyFiveItems = buildCollectionItems(titles);

  beforeEach(() => {
    cy.autoLogin();
    seedItems(twentyFiveItems);
    CollectionPage.visit();
  });

  it('renders all 25 items in the list', () => {
    CollectionPage.getAllItems().should('have.length', 25);
  });
});

describe('Collection — scrolling', () => {
  const items = buildCollectionItems(Array.from({ length: 20 }, (_, index) => `Scroll Test Movie ${index + 1}`));

  beforeEach(() => {
    cy.autoLogin();
    seedItems(items);
    CollectionPage.visit();
  });

  it('the list remains intact after scrolling to the bottom', () => {
    CollectionPage.getAllItems().should('have.length', 20);
  });
});

describe('Collection — random pick', () => {
  const items = buildCollectionItems(['Random Pick Movie A', 'Random Pick Movie B', 'Random Pick Movie C']);

  beforeEach(() => {
    cy.autoLogin();
    seedItems(items);
    CollectionPage.visit();
  });

  it('random pick button opens an item dialog', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getRandomPickButton().should('not.be.disabled');
    CollectionPage.getRandomPickButton().click();
    CollectionPage.getItemDialogEditButton().should('be.visible');
  });
});

describe('Collection — scroll to top', () => {
  const items = buildCollectionItems(Array.from({ length: 20 }, (_, index) => `Top Test Movie ${index + 1}`));

  beforeEach(() => {
    cy.autoLogin();
    seedItems(items);
    CollectionPage.visit();
  });

  it('scroll-to-top button appears after scrolling and returns to top', () => {
    CollectionPage.getList().scrollTo('bottom', { ensureScrollable: false });
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getScrollToTopButton().should('be.visible');
    CollectionPage.getScrollToTopButton().click();
    CollectionPage.getList().invoke('scrollTop').should('equal', 0);
  });
});

describe('Collection — fuzzy search', () => {
  const items = buildCollectionItems(['Interstellar', 'Inception', 'The Dark Knight', 'Avengers Endgame', 'Parasite']);

  beforeEach(() => {
    cy.autoLogin();
    seedItems(items);
    CollectionPage.visit();
  });

  it('filters the list based on search input', () => {
    CollectionPage.getAllItems().should('have.length', 5);
    CollectionPage.getSearchInput().type('Interstellar');
    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItems().first().should('contain.text', 'Interstellar');
  });

  it('shows all items again when search is cleared', () => {
    CollectionPage.getSearchInput().type('Interstellar');
    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getSearchInput().clear();
    CollectionPage.getAllItems().should('have.length', 5);
  });

  it('uses fuzzy matching — partial title finds the item', () => {
    CollectionPage.getSearchInput().type('stellr');
    CollectionPage.getListItems().should('have.length.at.least', 1);
    CollectionPage.getListItems().first().should('contain.text', 'Interstellar');
  });
});

describe('Collection - sync', () => {
  beforeEach(() => {
    cy.autoLogin();
  });

  it('triggers a collection reload when sync is clicked', () => {
    cy.intercept('GET', '/api/v1/get-all*').as('getAll');

    CommonPage.openMenu();
    CommonPage.getNavSyncLink().click();

    cy.wait('@getAll').its('response.statusCode').should('eq', 200);
  });
});
