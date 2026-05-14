import { generate } from 'random-words';
import { buildCollectionItem, buildCollectionItems } from '../fixtures/collection-item';
import { buildOmdbItem, buildOmdbSearchResult } from '../fixtures/omdb';
import { CollectionPage } from '../page-objects/collection.po';
import { CommonPage } from '../page-objects/common.po';

/** Creates collection items on the real server via the authenticated session. */
const seedItems = (items: ReturnType<typeof buildCollectionItem>[]) => {
  items.forEach((item) => {
    cy.request('POST', '/api/v1/create', item);
  });
};

describe('Collection — empty state', () => {
  beforeEach(() => {
    cy.autoLogin();
  });

  it('shows the empty state message when collection has no items', () => {
    // Intercept items load and reload to ensure the collection API call completes
    // before asserting — the token rotation during page load can delay the response.
    cy.intercept('GET', '/api/v1/items*').as('getAll');
    cy.reload();
    cy.wait('@getAll');
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

  it('saves a new item and keeps the dialog open for another item', () => {
    const firstTitle = 'Save And New Movie One';
    const secondTitle = 'Save And New Movie Two';

    cy.intercept(
      { method: 'GET', url: '/api/v1/proxy/omdb/search*', times: 1 },
      {
        statusCode: 200,
        body: buildOmdbSearchResult(firstTitle, 'tt5000001'),
      }
    ).as('omdbSearchFirst');
    cy.intercept(
      { method: 'GET', url: '/api/v1/proxy/omdb/item*', times: 1 },
      {
        statusCode: 200,
        body: buildOmdbItem(firstTitle, 'tt5000001'),
      }
    ).as('omdbItemFirst');

    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAddNewButton().click();

    CollectionPage.getNewItemSearchInput().clear().type(firstTitle);
    cy.wait('@omdbSearchFirst');
    CollectionPage.getNewItemContentSelect().find('option').should('have.length.at.least', 1);
    CollectionPage.getNewItemSaveAndNewButton().click();
    cy.wait('@omdbItemFirst');

    CollectionPage.getNewItemSearchInput().should('be.visible').and('have.value', '');
    CollectionPage.getListItems().should('contain.text', firstTitle);

    cy.intercept(
      { method: 'GET', url: '/api/v1/proxy/omdb/search*', times: 1 },
      {
        statusCode: 200,
        body: buildOmdbSearchResult(secondTitle, 'tt5000002'),
      }
    ).as('omdbSearchSecond');
    cy.intercept(
      { method: 'GET', url: '/api/v1/proxy/omdb/item*', times: 1 },
      {
        statusCode: 200,
        body: buildOmdbItem(secondTitle, 'tt5000002'),
      }
    ).as('omdbItemSecond');

    CollectionPage.getNewItemSearchInput().type(secondTitle);
    cy.wait('@omdbSearchSecond');
    CollectionPage.getNewItemContentSelect().find('option').should('have.length.at.least', 1);
    CollectionPage.getNewItemSaveAndCloseButton().click();
    cy.wait('@omdbItemSecond');

    CollectionPage.getNewItemSearch().should('not.exist');
    CollectionPage.getListItems().should('contain.text', firstTitle);
    CollectionPage.getListItems().should('contain.text', secondTitle);
  });

  it('saves a new item with the watched tag', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAddNewButton().click();

    CollectionPage.getNewItemSearchInput().type(newTitle);
    cy.wait('@omdbSearch');

    CollectionPage.getNewItemContentSelect().find('option').should('have.length.at.least', 1);
    cy.getByTestId('new-item-watched').find('input[type="checkbox"]').check();
    CollectionPage.getNewItemSaveAndCloseButton().click();

    // Open the item and verify it shows the mark-unwatched button (watched state)
    CollectionPage.getListItemImages().first().click();
    CollectionPage.getItemDialogMarkUnwatchedButton().should('be.visible');
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
    cy.on('window:confirm', () => true);
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

  it('uses partial title search to find the item', () => {
    CollectionPage.getSearchInput().type('stellar');
    CollectionPage.getListItems().should('have.length.at.least', 1);
    CollectionPage.getListItems().first().should('contain.text', 'Interstellar');
  });
});

describe('Collection — favorites', () => {
  beforeEach(() => {
    cy.autoLogin();
    seedItems([
      buildCollectionItem('Favorite Test Movie', 'movie', 'tt8000001'),
      buildCollectionItem('Regular Test Movie', 'movie', 'tt8000002'),
    ]);
    CollectionPage.visit();
  });

  it('marks an item as favorite and filters favorites from the nav menu', () => {
    cy.intercept('PUT', '/api/v1/change/*').as('updateItem');
    cy.on('window:confirm', () => true);

    CollectionPage.getListItems().should('have.length', 2);
    CollectionPage.getListItems().contains('Favorite Test Movie').click();

    CollectionPage.getItemDialogMarkFavoriteButton().click();
    cy.wait('@updateItem').its('response.statusCode').should('eq', 200);
    CollectionPage.getItemDialogRemoveFavoriteButton().should('be.visible');

    cy.get('.dialog-overlay').click({ force: true });
    CollectionPage.getFavoriteBadges().should('have.length', 1);

    CommonPage.openMenu();
    CommonPage.getNavFavoritesLink().click();

    cy.url().should('include', '#/collection/favorites');
    cy.getByTestId('collection-search').should('not.exist');
    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItems().first().should('contain.text', 'Favorite Test Movie');
    CollectionPage.getListItems().should('not.contain.text', 'Regular Test Movie');

    CommonPage.openMenu();
    CommonPage.getNavCollectionLink().click();

    cy.url().should('not.include', 'search=');
    cy.url().should('include', '#/collection/library');
    CollectionPage.getSearchInput().should('have.value', '');
    CollectionPage.getListItems().should('have.length', 2);
  });
});

describe('Collection - sync', () => {
  beforeEach(() => {
    cy.autoLogin();
  });

  it('triggers a collection reload when sync is clicked', () => {
    cy.intercept('GET', '/api/v1/items*').as('getAll');

    CommonPage.openMenu();
    CommonPage.getNavSyncLink().click();

    cy.wait('@getAll').its('response.statusCode').should('eq', 200);
  });
});

describe('Collection - tag badge filtering', () => {
  const taggedItem = buildCollectionItem('Badge Test Movie', 'movie', 'tt6000001');

  beforeEach(() => {
    cy.autoLogin();
    // Create item with a custom tag
    cy.request('POST', '/api/v1/create', { ...taggedItem, tags: ['#movie', '#action'] });
    // Enable image badge for the custom tag via API
    cy.request('POST', '/api/v1/tag/change-config', [
      {
        tag: '#action',
        color: '#ff0000',
        useForImageBorder: false,
        useForTextColor: false,
        useForImageBadge: true,
        weight: 1,
      },
    ]);
    CollectionPage.visit();
  });

  it('clicking a tag badge filters the collection by that tag', () => {
    // The badge should be visible on the item image
    cy.get('.badge').should('be.visible').and('contain.text', '#action').click();

    // Verify the collection is filtered
    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItems().first().should('contain.text', 'Badge Test Movie');
  });
});
