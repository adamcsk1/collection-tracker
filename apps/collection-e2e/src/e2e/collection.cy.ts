import type { Interception } from 'cypress/types/net-stubbing';
import { buildCollectionItem, buildCollectionItems } from '../fixtures/collection-item';
import { buildBooksItem } from '../fixtures/openlibrary';
import { buildOmdbItem, buildOmdbSearchResult } from '../fixtures/omdb';
import { CollectionPage } from '../page-objects/collection.po';
import { CommonPage } from '../page-objects/common.po';

/** Creates collection items on the real server via the authenticated session. */
const seedItems = (items: ReturnType<typeof buildCollectionItem>[]) => {
  items.forEach((item) => {
    cy.request('POST', '/api/v1/collection-items', item);
  });
};

const expectVisibleTitles = (titles: string[]) => {
  CollectionPage.getListItems().should('have.length', titles.length);
  titles.forEach((title, index) => {
    CollectionPage.getListItems().eq(index).should('contain.text', title);
  });
};

const saveManualItem = (
  title: string,
  imdbId: string,
  contentType: 'movie' | 'series',
  listType: 'library' | 'up-next' | 'wishlist' | 'tracking'
) => {
  cy.intercept('POST', '/api/v1/collection-items').as('createManualItem');
  CollectionPage.getNewItemManualModeButton().click();
  CollectionPage.getNewItemManualContentTypeSelect().select(contentType);
  CollectionPage.getNewItemManualTitleInput().type(title);
  CollectionPage.getNewItemManualImdbIdInput().type(imdbId);
  CollectionPage.getNewItemSaveAndCloseButton().should('be.enabled').click();

  cy.wait('@createManualItem').then(({ request, response }) => {
    expect(request.body).to.deep.include({
      title,
      IMDbId: imdbId,
      externalProvider: 'omdb',
      externalItemId: imdbId,
      contentType,
      favorite: false,
    });
    if (listType !== 'library') expect(request.body.listType).to.equal(listType);
    expect(request.body.externalIds).to.deep.equal([{ source: 'imdb', id: imdbId }]);
    expect(response?.statusCode).to.equal(200);
  });
};

const reloadAndExpectPersistedTitle = (title: string, expectedItemCount = 1) => {
  cy.intercept('GET', '/api/v1/collection-items*').as('reloadItems');
  cy.reload();
  cy.wait('@reloadItems');
  CollectionPage.getListItems().should('have.length', expectedItemCount).and('contain.text', title);
};

const waitForItemsRequestIncluding = (expectedUrlParts: string[]): Cypress.Chainable<Interception> => {
  return cy.wait('@getItems').then((interception) => {
    const requestUrl = interception.request.url;

    if (expectedUrlParts.every((expectedUrlPart) => requestUrl.includes(expectedUrlPart))) {
      return cy.wrap(interception, { log: false });
    }

    return waitForItemsRequestIncluding(expectedUrlParts);
  });
};

const showOrderControls = () => {
  cy.get('body')
    .should((body) => {
      expect(
        body.find('[data-test-id="show-functions"], [data-test-id="list-order-by-created-at"]').length
      ).to.be.greaterThan(0);
    })
    .then((body) => {
      if (body.find('[data-test-id="show-functions"]').length) {
        CollectionPage.getShowFunctionsButton().click();
      }
    });
  CollectionPage.getOrderByCreatedAtButton().should('be.visible');
  CollectionPage.getOrderByAlphabetButton().should('be.visible');
  CollectionPage.getOrderDirectionDescButton().should('be.visible');
  CollectionPage.getOrderDirectionAscButton().should('be.visible');
};

describe('Collection — empty state', () => {
  beforeEach(() => {
    cy.autoLogin();
  });

  it('shows the empty state message when collection has no items', () => {
    // Intercept items load and reload to ensure the collection API call completes
    // before asserting — the token rotation during page load can delay the response.
    cy.intercept('GET', '/api/v1/collection-items*').as('getAll');
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
    cy.intercept('GET', '/api/v1/external-metadata/search*', {
      statusCode: 200,
      body: { data: buildOmdbSearchResult(newTitle) },
    }).as('omdbSearch');
    cy.intercept('GET', '/api/v1/external-metadata/items*', {
      statusCode: 200,
      body: { data: buildOmdbItem(newTitle) },
    }).as('omdbItem');

    cy.autoLogin();
  });

  it('opens the new-item dialog via float buttons', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAddNewButton().click();
    CollectionPage.getNewItemSearchInput().should('be.visible');
    CollectionPage.getNewItemActionButtons()
      .should('have.length', 3)
      .each((button) => {
        cy.wrap(button).should('have.class', 'button-icon').and('have.class', 'button-reveal-label');
        cy.wrap(button).invoke('attr', 'aria-label').should('not.be.empty');
        cy.wrap(button).invoke('attr', 'title').should('not.be.empty');
        cy.wrap(button).parents('.dialog-footer').should('exist');
      });
  });

  it('searches external metadata, saves the item, and it appears in the list', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAddNewButton().click();

    CollectionPage.getNewItemSearchInput().type(newTitle);
    cy.wait('@omdbSearch');

    CollectionPage.getNewItemContentOptions().should('have.length.at.least', 1);
    CollectionPage.getNewItemSaveButton().click();

    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItems().first().should('contain.text', newTitle);
  });

  it('searches external metadata when enter is pressed in the new-item search', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAddNewButton().click();

    CollectionPage.getNewItemSearchInput().type(`${newTitle}{enter}`);

    cy.wait('@omdbSearch');
    CollectionPage.getNewItemSearchInput().should('have.value', newTitle);
    CollectionPage.getNewItemContentOptions().should('have.length.at.least', 1);
  });

  it('saves a new item and keeps the dialog open for another item', () => {
    const firstTitle = 'Save And New Movie One';
    const secondTitle = 'Save And New Movie Two';

    cy.intercept(
      { method: 'GET', url: '/api/v1/external-metadata/search*', times: 1 },
      {
        statusCode: 200,
        body: { data: buildOmdbSearchResult(firstTitle, 'tt5000001') },
      }
    ).as('omdbSearchFirst');
    cy.intercept(
      { method: 'GET', url: '/api/v1/external-metadata/items*', times: 1 },
      {
        statusCode: 200,
        body: { data: buildOmdbItem(firstTitle, 'tt5000001') },
      }
    ).as('omdbItemFirst');

    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAddNewButton().click();

    CollectionPage.getNewItemSearchInput().clear().type(firstTitle);
    cy.wait('@omdbSearchFirst');
    CollectionPage.getNewItemContentOptions().should('have.length.at.least', 1);
    CollectionPage.getNewItemSaveAndNewButton().click();
    cy.wait('@omdbItemFirst');

    CollectionPage.getNewItemSearchInput().scrollIntoView().should('be.visible').and('have.value', '');
    CollectionPage.getListItems().should('contain.text', firstTitle);

    cy.intercept(
      { method: 'GET', url: '/api/v1/external-metadata/search*', times: 1 },
      {
        statusCode: 200,
        body: { data: buildOmdbSearchResult(secondTitle, 'tt5000002') },
      }
    ).as('omdbSearchSecond');
    cy.intercept(
      { method: 'GET', url: '/api/v1/external-metadata/items*', times: 1 },
      {
        statusCode: 200,
        body: { data: buildOmdbItem(secondTitle, 'tt5000002') },
      }
    ).as('omdbItemSecond');

    CollectionPage.getNewItemSearchInput().type(secondTitle);
    cy.wait('@omdbSearchSecond');
    CollectionPage.getNewItemContentOptions().should('have.length.at.least', 1);
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

    CollectionPage.getNewItemContentOptions().should('have.length.at.least', 1);
    cy.getByTestId('new-item-finished').find('input[type="checkbox"]').check();
    CollectionPage.getNewItemSaveAndCloseButton().click();

    // Open the item and verify it shows the mark-unwatched button (watched state)
    CollectionPage.getListItems().contains(newTitle).click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogMarkUnfinishedButton().should('be.visible');
  });

  it('saves a new item with a user rate', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAddNewButton().click();

    CollectionPage.getNewItemSearchInput().type(newTitle);
    cy.wait('@omdbSearch');

    CollectionPage.getNewItemContentOptions().should('have.length.at.least', 1);
    CollectionPage.getNewItemUserRateInput().type('8.7');
    CollectionPage.getNewItemSaveAndCloseButton().click();

    CollectionPage.setListPreferredRatingToUser();
    CollectionPage.visit();
    CollectionPage.getListItemUserRates().should('contain.text', '8.7');
    CollectionPage.getListItemImages().first().click();
    CollectionPage.getItemDialogUserRateChip().should('contain.text', '8.7');
  });

  it('keeps save disabled for an invalid new item user rate', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAddNewButton().click();

    CollectionPage.getNewItemSearchInput().type(newTitle);
    cy.wait('@omdbSearch');

    CollectionPage.getNewItemContentOptions().should('have.length.at.least', 1);
    CollectionPage.getNewItemUserRateInput().type('10.1');
    CollectionPage.getNewItemSaveAndCloseButton().should('be.disabled');
  });

  it('adds a new item manually and persists it after reload', () => {
    const manualTitle = 'Manual Test Movie';
    const manualImdbId = 'tt9990001';
    cy.intercept('POST', '/api/v1/collection-items').as('createItem');

    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAddNewButton().click();

    CollectionPage.getNewItemManualModeButton().click();
    CollectionPage.getNewItemManualHint().should('be.visible');
    CollectionPage.getNewItemManualTitleInput().type(manualTitle);
    CollectionPage.getNewItemManualImdbIdInput().type(manualImdbId);
    CollectionPage.getNewItemSaveAndCloseButton().should('be.enabled').click();

    cy.wait('@createItem').then(({ request, response }) => {
      expect(request.body).to.deep.include({
        title: manualTitle,
        IMDbId: manualImdbId,
        externalProvider: 'omdb',
        externalItemId: manualImdbId,
        contentType: 'movie',
        favorite: false,
      });
      expect(request.body.externalIds).to.deep.equal([{ source: 'imdb', id: manualImdbId }]);
      expect(response?.statusCode).to.equal(200);
      expect(response?.body.data.item).to.deep.include({
        title: manualTitle,
        IMDbId: manualImdbId,
        externalProvider: 'omdb',
        externalItemId: manualImdbId,
        contentType: 'movie',
      });
    });

    cy.intercept('GET', '/api/v1/collection-items*').as('reloadItems');
    cy.reload();
    cy.wait('@reloadItems');
    CollectionPage.getListItems().should((titleElements) => {
      expect([...titleElements].map((titleElement) => titleElement.textContent?.trim())).to.deep.equal([manualTitle]);
    });
  });

  it('keeps manual save disabled for invalid required fields', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAddNewButton().click();

    CollectionPage.getNewItemManualModeButton().click();
    CollectionPage.getNewItemManualTitleInput().type('Manual Title');

    CollectionPage.getNewItemSaveAndCloseButton().should('be.disabled');

    CollectionPage.getNewItemManualImdbIdInput().type('not-an-imdb-id');
    CollectionPage.getNewItemSaveAndCloseButton().should('be.disabled');
  });

  it('keeps the manual image preview below the manual entry hint', () => {
    const expectPreviewBelowHint = () => {
      CollectionPage.getNewItemManualHintAndPreview().should((elements) => {
        expect(elements).to.have.length(2);
        const hintBottom = elements[0]!.getBoundingClientRect().bottom;
        const previewTop = elements[1]!.getBoundingClientRect().top;
        expect(previewTop).to.be.greaterThan(hintBottom);
      });
    };

    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAddNewButton().click();
    CollectionPage.getNewItemManualModeButton().click();
    CollectionPage.getNewItemManualImageInput().type('data:image/gif;base64,R0lGODlhAQABAAAAACw=');

    cy.viewport(375, 667);
    expectPreviewBelowHint();
    cy.viewport(1280, 800);
    expectPreviewBelowHint();
  });

  it('switches back to search mode preserving the search input', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAddNewButton().click();

    CollectionPage.getNewItemSearchInput().type(newTitle);
    CollectionPage.getNewItemManualModeButton().click();
    CollectionPage.getNewItemSearchModeButton().click();

    CollectionPage.getNewItemSearchInput().should('have.value', newTitle);
  });

  it('switches entry modes with accessible keyboard tabs', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAddNewButton().click();

    CollectionPage.getNewItemModeTabs().should('have.attr', 'aria-label', 'Item entry method');
    CollectionPage.getNewItemSearchModeButton()
      .should('have.attr', 'aria-selected', 'true')
      .focus()
      .type('{rightarrow}');

    CollectionPage.getNewItemManualModeButton().should('have.focus').and('have.attr', 'aria-selected', 'true');
    CollectionPage.getNewItemSearchPanel().should('not.be.visible');
    CollectionPage.getNewItemManualPanel().should('be.visible');

    CollectionPage.getNewItemManualModeButton().type('{leftarrow}');
    CollectionPage.getNewItemSearchModeButton().should('have.focus').and('have.attr', 'aria-selected', 'true');
    CollectionPage.getNewItemSearchPanel().should('be.visible');
    CollectionPage.getNewItemManualPanel().should('not.be.visible');
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
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogEditButton().should('be.visible');
  });

  it('enters edit mode and the save button appears', () => {
    CollectionPage.getListItemImages().first().click();
    CollectionPage.expectItemDialogActionsVisible();
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
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogDeleteButton().click();
    CollectionPage.getEmptyState().should('be.visible');
  });
});

describe('Collection — cursor pagination and API errors', () => {
  const titles = Array.from({ length: 55 }, (_, index) => `Cursor Test Movie ${String(index + 1).padStart(2, '0')}`);

  beforeEach(() => {
    cy.autoLogin();
  });

  it('continues the real cursor page when the collection list reaches the bottom', () => {
    seedItems(buildCollectionItems(titles));
    cy.intercept('GET', '/api/v1/collection-items*').as('getCursorPage');
    CollectionPage.visit();

    let firstCursor = '';
    cy.wait('@getCursorPage').then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(response?.body).to.have.all.keys('data', 'page');
      expect(response?.body.data).to.have.length(50);
      expect(response?.body.page).to.have.all.keys('limit', 'hasMore', 'nextCursor');
      expect(response?.body.page).to.deep.include({ limit: 50, hasMore: true });
      expect(response?.body.page.nextCursor).to.be.a('string').and.not.be.empty;
      firstCursor = response?.body.page.nextCursor;
    });

    CollectionPage.getListItems().should('have.length', 50);
    CollectionPage.getList().scrollTo('bottom').trigger('scroll');

    cy.wait('@getCursorPage').then(({ request, response }) => {
      const requestUrl = new URL(request.url);
      expect(requestUrl.searchParams.get('cursor')).to.equal(firstCursor);
      expect(response?.statusCode).to.equal(200);
      expect(response?.body.data).to.have.length(5);
      expect(response?.body.page).to.deep.equal({ limit: 50, hasMore: false, nextCursor: null });
    });

    CollectionPage.getListItems().should((titleElements) => {
      const renderedTitles = [...titleElements].map((titleElement) => titleElement.textContent?.trim());
      expect(renderedTitles).to.have.length(55);
      expect(new Set(renderedTitles).size).to.equal(55);
      expect(renderedTitles.sort()).to.deep.equal([...titles].sort());
    });
  });

  it('returns RFC 9457 Problem Details for an invalid collection query', () => {
    cy.request({
      method: 'GET',
      url: '/api/v1/collection-items?limit=0',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.equal(400);
      expect(response.headers['content-type']).to.include('application/problem+json');
      expect(response.body).to.deep.equal({
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'HTTP_400',
        instance: '/api/v1/collection-items',
      });
    });
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
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogEditButton().should('be.visible');
  });
});

describe('Collection — scroll to top', () => {
  const items = buildCollectionItems(Array.from({ length: 60 }, (_, index) => `Top Test Movie ${index + 1}`));

  beforeEach(() => {
    cy.autoLogin();
    seedItems(items);
    CollectionPage.visit();
  });

  it('scroll-to-top button appears after scrolling and returns to top', () => {
    CollectionPage.getListItems().should('have.length', 50);
    CollectionPage.getList().scrollTo('bottom').trigger('scroll');
    CollectionPage.getList().invoke('scrollTop').should('be.greaterThan', 0);
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

describe('Collection — standard search in secondary lists', () => {
  beforeEach(() => {
    cy.autoLogin();
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Wishlist Search Alpha', 'movie', 'tt8300001'),
      listType: 'wishlist',
    });
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Wishlist Search Beta', 'movie', 'tt8300002'),
      listType: 'wishlist',
    });
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Watch Later Search Alpha', 'movie', 'tt8300003'),
      listType: 'up-next',
    });
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Watch Later Search Beta', 'movie', 'tt8300004'),
      listType: 'up-next',
    });
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Series Tracker Search Alpha', 'series', 'tt8300005'),
      listType: 'tracking',
    });
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Series Tracker Search Beta', 'series', 'tt8300006'),
      listType: 'tracking',
    });
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Movie Tracker Search Alpha', 'movie', 'tt8300007'),
      listType: 'tracking',
    });
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Movie Tracker Search Beta', 'movie', 'tt8300008'),
      listType: 'tracking',
    });
  });

  it('filters wishlist items and requests wishlist-scoped suggestions', () => {
    cy.intercept('GET', '/api/v1/collection-items/suggestions*').as('searchSuggestions');

    CommonPage.openMenu();
    CommonPage.getNavWishlistLink().click();

    CollectionPage.getWishlistSearchInput().should('be.visible').type('Alpha');
    cy.wait('@searchSuggestions').its('request.url').should('include', 'listType=wishlist');
    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItems().first().should('contain.text', 'Wishlist Search Alpha');
    CollectionPage.getListItems().should('not.contain.text', 'Wishlist Search Beta');
  });

  it('filters watch later items', () => {
    CommonPage.openMenu();
    CommonPage.getNavUpNextLink().click();

    CollectionPage.getUpNextSearchInput().should('be.visible').type('Alpha');
    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItems().first().should('contain.text', 'Watch Later Search Alpha');
    CollectionPage.getListItems().should('not.contain.text', 'Watch Later Search Beta');
  });

  it('filters tracking items', () => {
    CommonPage.openMenu();
    CommonPage.getNavTrackingLink().click();

    CollectionPage.getTrackingSearchInput().should('be.visible').type('Series Tracker Search Alpha');
    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItems().first().should('contain.text', 'Series Tracker Search Alpha');
    CollectionPage.getListItems().should('not.contain.text', 'Series Tracker Search Beta');
    CollectionPage.getListItems().should('not.contain.text', 'Movie Tracker Search Alpha');
  });
});

describe('Collection — order controls', () => {
  beforeEach(() => {
    cy.autoLogin();
  });

  it('orders library items and persists the selected order after refresh', () => {
    seedItems([
      buildCollectionItem('Order Alpha', 'movie', 'tt8400001'),
      buildCollectionItem('Order Charlie', 'movie', 'tt8400002'),
      buildCollectionItem('Order Bravo', 'movie', 'tt8400003'),
    ]);
    cy.intercept('GET', '/api/v1/collection-items*').as('getItems');
    CollectionPage.visit();
    cy.wait('@getItems');

    expectVisibleTitles(['Order Bravo', 'Order Charlie', 'Order Alpha']);

    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getOrderDirectionAscButton().click();
    waitForItemsRequestIncluding(['orderDirection=asc']);
    cy.url().should('include', 'orderDirection=asc');
    cy.url().should('not.include', 'orderBy=');
    expectVisibleTitles(['Order Alpha', 'Order Charlie', 'Order Bravo']);

    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getOrderByAlphabetButton().click();
    waitForItemsRequestIncluding(['orderBy=alphabet']);
    cy.url().should('include', 'orderBy=alphabet');
    cy.url().should('include', 'orderDirection=asc');
    expectVisibleTitles(['Order Alpha', 'Order Bravo', 'Order Charlie']);

    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getOrderDirectionDescButton().click();
    waitForItemsRequestIncluding(['orderDirection=desc']);
    cy.url().should('include', 'orderBy=alphabet');
    cy.url().should('not.include', 'orderDirection=');
    expectVisibleTitles(['Order Charlie', 'Order Bravo', 'Order Alpha']);

    cy.reload();
    waitForItemsRequestIncluding(['orderBy=alphabet', 'orderDirection=desc']);
    cy.url().should('include', 'orderBy=alphabet');
    expectVisibleTitles(['Order Charlie', 'Order Bravo', 'Order Alpha']);
  });

  it('applies order from the query string', () => {
    seedItems([
      buildCollectionItem('Query Alpha', 'movie', 'tt8400031'),
      buildCollectionItem('Query Charlie', 'movie', 'tt8400032'),
      buildCollectionItem('Query Bravo', 'movie', 'tt8400033'),
    ]);
    cy.intercept('GET', '/api/v1/collection-items*').as('getItems');
    CollectionPage.visitLibraryWithQuery('orderBy=alphabet&orderDirection=asc');
    waitForItemsRequestIncluding(['orderBy=alphabet', 'orderDirection=asc']);
    cy.url().should('include', 'orderBy=alphabet');
    cy.url().should('include', 'orderDirection=asc');
    expectVisibleTitles(['Query Alpha', 'Query Bravo', 'Query Charlie']);
  });

  it('keeps order query params when an item is opened and closed', () => {
    seedItems([buildCollectionItem('Order Url Movie', 'movie', 'tt8400034')]);
    CollectionPage.visitLibraryWithQuery('orderBy=alphabet');
    CollectionPage.getListItemImages().first().click();
    CollectionPage.getItemDialogHost().should('be.visible');
    cy.url().should('include', 'orderBy=alphabet');
    cy.url().should('include', 'item=omdb:tt8400034');

    CollectionPage.closeDialogByOverlay();
    CollectionPage.getItemDialogShellHost().should('not.exist');
    cy.url().should('include', 'orderBy=alphabet');
    cy.url().should('not.include', 'item=');
  });

  it('keeps order preferences isolated per collection page', () => {
    seedItems([
      buildCollectionItem('Library Alpha', 'movie', 'tt8400011'),
      buildCollectionItem('Library Bravo', 'movie', 'tt8400012'),
    ]);
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Wishlist Alpha', 'movie', 'tt8400013'),
      listType: 'wishlist',
    });
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Wishlist Bravo', 'movie', 'tt8400014'),
      listType: 'wishlist',
    });
    cy.intercept('GET', '/api/v1/collection-items*').as('getItems');
    CollectionPage.visit();
    cy.wait('@getItems');

    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getOrderByAlphabetButton().click();
    cy.wait('@getItems');
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getOrderDirectionAscButton().click();
    waitForItemsRequestIncluding(['orderBy=alphabet', 'orderDirection=asc']);
    cy.url().should('include', 'orderBy=alphabet');
    cy.url().should('include', 'orderDirection=asc');
    expectVisibleTitles(['Library Alpha', 'Library Bravo']);

    CommonPage.openMenu();
    CommonPage.getNavWishlistLink().click();
    waitForItemsRequestIncluding(['listType=wishlist', 'orderBy=createdAt', 'orderDirection=desc']);
    cy.url().should('include', '#/collection/wishlist');
    cy.url().should('not.include', 'orderBy=');
    expectVisibleTitles(['Wishlist Bravo', 'Wishlist Alpha']);

    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getOrderByAlphabetButton().click();
    waitForItemsRequestIncluding(['listType=wishlist', 'orderBy=alphabet']);
    cy.url().should('include', 'orderBy=alphabet');
    cy.reload();
    waitForItemsRequestIncluding(['listType=wishlist', 'orderBy=alphabet']);
    expectVisibleTitles(['Wishlist Bravo', 'Wishlist Alpha']);

    CommonPage.openMenu();
    CommonPage.getNavCollectionLink().click();
    waitForItemsRequestIncluding(['listType=library', 'orderBy=alphabet', 'orderDirection=asc']);
    expectVisibleTitles(['Library Alpha', 'Library Bravo']);
  });

  it('shows order controls on secondary collection pages', () => {
    cy.intercept('GET', '/api/v1/collection-items*').as('getItems');
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Watch Later Order', 'movie', 'tt8400021'),
      listType: 'up-next',
    });
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Wishlist Order', 'movie', 'tt8400022'),
      listType: 'wishlist',
    });
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Series Tracker Order', 'series', 'tt8400023'),
      listType: 'tracking',
    });
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Movie Tracker Order', 'movie', 'tt8400025'),
      listType: 'tracking',
    });
    CommonPage.openMenu();
    CommonPage.getNavUpNextLink().click();
    cy.url().should('include', '#/collection/up-next');
    cy.wait('@getItems');
    showOrderControls();

    CommonPage.openMenu();
    CommonPage.getNavWishlistLink().click();
    cy.url().should('include', '#/collection/wishlist');
    cy.wait('@getItems');
    showOrderControls();

    CommonPage.openMenu();
    CommonPage.getNavTrackingLink().click();
    cy.url().should('include', '#/collection/tracking');
    cy.wait('@getItems');
    showOrderControls();
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

  it('marks an item as favorite and filters favorites from the library actions menu', () => {
    cy.intercept('PUT', '/api/v1/collection-items/**').as('updateItem');
    cy.on('window:confirm', () => true);

    CollectionPage.getListItems().should('have.length', 2);
    CollectionPage.getListItems().contains('Favorite Test Movie').click();

    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogMarkFavoriteButton().click();
    cy.wait('@updateItem').its('response.statusCode').should('eq', 200);
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogRemoveFavoriteButton().should('be.visible');

    CollectionPage.closeActiveDialogByOverlay();
    CollectionPage.getFavoriteBadges().should('have.length', 1);

    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getCollectionFilterButton('favorite').click();

    cy.url().should('include', '#/collection/library');
    cy.url().should('include', 'favorite=true');
    CollectionPage.getSearchInput().should('have.value', '');
    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItems().first().should('contain.text', 'Favorite Test Movie');
    CollectionPage.getListItems().should('not.contain.text', 'Regular Test Movie');

    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getCollectionFilterButton('favorite').click();

    cy.url().should('not.include', 'search=');
    cy.url().should('not.include', 'favorite=true');
    cy.url().should('include', '#/collection/library');
    CollectionPage.getSearchInput().should('have.value', '');
    CollectionPage.getListItems().should('have.length', 2);
  });
});

describe('Collection — watch later', () => {
  beforeEach(() => {
    cy.autoLogin();
  });

  it('adds a manual watch later item and persists it after reload', () => {
    const manualTitle = 'Manual Watch Later Movie';
    CommonPage.openMenu();
    CommonPage.getNavUpNextLink().click();
    CollectionPage.getAddFirstUpNextItemLink().click();

    saveManualItem(manualTitle, 'tt8110001', 'movie', 'up-next');
    reloadAndExpectPersistedTitle(manualTitle);
  });
});

describe('Collection — wishlist', () => {
  const wishlistTitle = 'Wishlist Test Movie';

  beforeEach(() => {
    cy.intercept('GET', '/api/v1/external-metadata/search*', {
      statusCode: 200,
      body: { data: buildOmdbSearchResult(wishlistTitle, 'tt8100001') },
    }).as('wishlistOmdbSearch');
    cy.intercept('GET', '/api/v1/external-metadata/items*', {
      statusCode: 200,
      body: { data: buildOmdbItem(wishlistTitle, 'tt8100001') },
    }).as('wishlistOmdbItem');

    cy.autoLogin();
  });

  it('navigates via the menu and adds a wishlist item from the empty state', () => {
    CommonPage.openMenu();
    CommonPage.getNavWishlistLink().click();

    cy.url().should('include', '#/collection/wishlist');
    cy.getByTestId('collection-search').should('not.exist');
    CollectionPage.getAddFirstWishlistItemLink().click();

    CollectionPage.getNewItemSearchInput().type(wishlistTitle);
    cy.wait('@wishlistOmdbSearch');
    CollectionPage.getNewItemContentOptions().should('have.length.at.least', 1);
    CollectionPage.getNewItemSaveAndCloseButton().click();
    cy.wait('@wishlistOmdbItem');

    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItems().first().should('contain.text', wishlistTitle);
  });

  it('adds a manual wishlist item and persists it after reload', () => {
    const manualTitle = 'Manual Wishlist Movie';
    CommonPage.openMenu();
    CommonPage.getNavWishlistLink().click();
    CollectionPage.getAddFirstWishlistItemLink().click();

    saveManualItem(manualTitle, 'tt8100002', 'movie', 'wishlist');
    reloadAndExpectPersistedTitle(manualTitle);
  });
});

describe('Collection — tracking series', () => {
  const seriesTitle = 'Series Tracker Test Show';

  beforeEach(() => {
    cy.intercept('GET', '/api/v1/external-metadata/search*', {
      statusCode: 200,
      body: {
        data: {
          results: [
            buildOmdbItem('Filtered Movie Result', 'tt8200000', 'movie'),
            buildOmdbItem(seriesTitle, 'tt8200001', 'series'),
          ],
        },
      },
    }).as('trackingOmdbSearch');
    cy.intercept('GET', '/api/v1/external-metadata/items*', {
      statusCode: 200,
      body: { data: buildOmdbItem(seriesTitle, 'tt8200001', 'series') },
    }).as('trackingOmdbItem');

    cy.autoLogin();
  });

  it('adds a series and persists watched-up-to progress', () => {
    cy.intercept('PUT', '/api/v1/collection-items/*/*/tracking/completed-episodes*').as('saveCompletedEpisodes');
    cy.on('window:confirm', () => true);

    CommonPage.openMenu();
    CommonPage.getNavTrackingLink().click();

    cy.url().should('include', '#/collection/tracking');
    cy.getByTestId('collection-search').should('not.exist');
    CollectionPage.getAddFirstTrackingItemLink().click();

    CollectionPage.getNewItemContentSelect().select('series');
    CollectionPage.getNewItemSearchInput().type(seriesTitle);
    cy.wait('@trackingOmdbSearch');
    CollectionPage.getNewItemContentOptions().should('have.length', 1).and('contain.text', seriesTitle);
    cy.getByTestId('new-item-user-rate').should('not.exist');
    cy.getByTestId('new-item-finished').should('not.exist');
    CollectionPage.getNewItemSaveAndCloseButton().click();
    cy.wait('@trackingOmdbItem');

    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItems().first().should('contain.text', seriesTitle);

    cy.request('PUT', '/api/v1/collection-items/omdb/tt8200001/tracking/seasons', {
      seasons: [{ season: 1, episodes: 3 }],
    });
    cy.reload();

    CollectionPage.getListItemImages().first().click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogManageCompletedEpisodesButton().click();
    CollectionPage.getCompletedEpisodesEpisodeCheckbox().eq(0).check();
    cy.wait('@saveCompletedEpisodes').its('response.statusCode').should('eq', 200);
    CollectionPage.getCompletedEpisodesEpisodeCheckbox().eq(1).check();
    cy.wait('@saveCompletedEpisodes').its('response.statusCode').should('eq', 200);
    CollectionPage.closeDialogByOverlay();
    CollectionPage.getCompletedEpisodesDialogHost().should('not.exist');
    CollectionPage.getItemDialogHost().should('be.visible');
    CollectionPage.getItemDialogEpisodeProgressChip().should('contain.text', 'S01E02');

    cy.reload();
    CollectionPage.getListItemImages().first().click();
    CollectionPage.getItemDialogEpisodeProgressChip().should('contain.text', 'S01E02');
  });

  it('adds a manual tracking item and persists it after reload', () => {
    const manualTitle = 'Manual Series Tracker Show';
    CommonPage.openMenu();
    CommonPage.getNavTrackingLink().click();
    CollectionPage.getAddFirstTrackingItemLink().click();

    saveManualItem(manualTitle, 'tt8200002', 'series', 'tracking');
    reloadAndExpectPersistedTitle(manualTitle);
  });
});

describe('Collection — tracking movies', () => {
  const movieTitle = 'Movie Tracker Test Movie';

  beforeEach(() => {
    cy.intercept('GET', '/api/v1/external-metadata/search*', {
      statusCode: 200,
      body: {
        data: {
          results: [
            buildOmdbItem('Filtered Series Result', 'tt8300000', 'series'),
            buildOmdbItem(movieTitle, 'tt8300001', 'movie'),
          ],
        },
      },
    }).as('trackingMovieOmdbSearch');
    cy.intercept('GET', '/api/v1/external-metadata/items*', {
      statusCode: 200,
      body: { data: buildOmdbItem(movieTitle, 'tt8300001', 'movie') },
    }).as('trackingMovieOmdbItem');

    cy.autoLogin();
  });

  it('navigates via the menu and adds a tracking item from the empty state', () => {
    CommonPage.openMenu();
    CommonPage.getNavTrackingLink().click();

    cy.url().should('include', '#/collection/tracking');
    cy.getByTestId('collection-search').should('not.exist');
    CollectionPage.getAddFirstTrackingItemLink().click();

    CollectionPage.getNewItemContentSelect().select('movie');
    CollectionPage.getNewItemSearchInput().type(movieTitle);
    cy.wait('@trackingMovieOmdbSearch');
    CollectionPage.getNewItemContentOptions().should('have.length', 1).and('contain.text', movieTitle);
    cy.getByTestId('new-item-user-rate').should('not.exist');
    cy.getByTestId('new-item-finished').should('not.exist');
    CollectionPage.getNewItemSaveAndCloseButton().click();
    cy.wait('@trackingMovieOmdbItem');

    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItems().first().should('contain.text', movieTitle);
    CollectionPage.getTrackingCompletedBadges().should('have.length', 1);
  });

  it('adds a manual item from a non-empty tracking and persists it after reload', () => {
    const existingTitle = 'Existing Movie Tracker Item';
    const manualTitle = 'Manual Movie Tracker Item';
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem(existingTitle, 'movie', 'tt8300002'),
      listType: 'tracking',
    });
    cy.intercept('GET', '/api/v1/collection-items*').as('trackingItems');
    CollectionPage.visitTracking();
    cy.wait('@trackingItems');
    CollectionPage.getListItems().should('contain.text', existingTitle);

    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAddNewButton().click();
    saveManualItem(manualTitle, 'tt8300003', 'movie', 'tracking');
    reloadAndExpectPersistedTitle(manualTitle, 2);
    CollectionPage.getListItems().should('contain.text', existingTitle);
  });

  it('opens the item dialog and shows watched status without episode controls', () => {
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem(movieTitle, 'movie', 'tt8300001'),
      listType: 'tracking',
    });
    CollectionPage.visitTracking();

    CollectionPage.getListItemImages().first().click();
    CollectionPage.getItemDialogCompletedChip().should('not.exist');
    CollectionPage.getItemDialogManageCompletedEpisodesButton().should('not.exist');
    CollectionPage.getItemDialogManageSeriesMetadataButton().should('not.exist');

    CollectionPage.closeActiveDialogByOverlay();
  });

  it('moves a movie from watchlist to tracking', () => {
    cy.intercept('POST', '/api/v1/collection-items/*/*/tracking*').as('moveToFinished');
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Watch Later Move Movie', 'movie', 'tt8300002'),
      listType: 'up-next',
    });
    CollectionPage.visitUpNext();

    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItemImages().first().click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogMoveFinishedButton().click();
    cy.wait('@moveToFinished').its('response.statusCode').should('eq', 200);

    CollectionPage.getEmptyState().should('be.visible');

    CollectionPage.visitTracking();
    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItems().first().should('contain.text', 'Watch Later Move Movie');
  });

  it('deletes a tracking item and shows empty state', () => {
    cy.intercept('DELETE', '/api/v1/collection-items/**').as('deleteTrackingItem');
    cy.on('window:confirm', () => true);

    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Delete Tracker Movie', 'movie', 'tt8300003'),
      listType: 'tracking',
    });
    CollectionPage.visitTracking();

    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItemImages().first().click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogDeleteButton().click();
    cy.wait('@deleteTrackingItem').its('response.statusCode').should('eq', 204);

    CollectionPage.getEmptyState().should('be.visible');
  });

  it('filters tracking items via search', () => {
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Alpha Movie', 'movie', 'tt8300004'),
      listType: 'tracking',
    });
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Beta Movie', 'movie', 'tt8300005'),
      listType: 'tracking',
    });
    CollectionPage.visitTracking();

    CollectionPage.getListItems().should('have.length', 2);
    CollectionPage.getTrackingSearchInput().type('Alpha');
    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItems().first().should('contain.text', 'Alpha Movie');
  });
});

describe('Collection — unified tracking gaps', () => {
  beforeEach(() => {
    cy.autoLogin();
  });

  it('redirects the legacy finished route to tracking', () => {
    CollectionPage.visitFinishedRedirect();
    cy.url().should('include', '#/collection/tracking');
    cy.url().should('not.include', '#/collection/finished');
  });

  it('filters tracking items with media chips', () => {
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Chip Movie', 'movie', 'tt8500001'),
      listType: 'tracking',
    });
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Chip Series', 'series', 'tt8500002'),
      listType: 'tracking',
    });
    cy.intercept('GET', '/api/v1/collection-items*').as('getItems');
    CollectionPage.visitTracking();
    waitForItemsRequestIncluding(['listType=tracking']);

    CollectionPage.getListItems().should('have.length', 2);
    CollectionPage.getMediaChip('movie').click();
    waitForItemsRequestIncluding(['listType=tracking', 'type=movie']);
    cy.url().should('include', 'type=movie');
    CollectionPage.getListItems().should('have.length', 1).and('contain.text', 'Chip Movie');
    CollectionPage.getListItems().should('not.contain.text', 'Chip Series');

    CollectionPage.getMediaChip('series').click();
    waitForItemsRequestIncluding(['listType=tracking', 'type=series']);
    cy.url().should('include', 'type=series');
    CollectionPage.getListItems().should('have.length', 1).and('contain.text', 'Chip Series');
    CollectionPage.getListItems().should('not.contain.text', 'Chip Movie');

    CollectionPage.getMediaChip('all').click();
    waitForItemsRequestIncluding(['listType=tracking']);
    cy.url().should('not.include', 'type=movie').and('not.include', 'type=series');
    CollectionPage.getListItems().should('have.length', 2);
  });

  it('moves a series from watchlist to tracking', () => {
    cy.intercept('POST', '/api/v1/collection-items/*/*/tracking*').as('moveToTracking');
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Watchlist Move Series', 'series', 'tt8500003'),
      listType: 'up-next',
    });
    CollectionPage.visitUpNext();

    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItemImages().first().click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogMoveTrackingButton().click();
    cy.wait('@moveToTracking').its('response.statusCode').should('eq', 200);

    CollectionPage.getEmptyState().should('be.visible');

    CollectionPage.visitTracking();
    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItems().first().should('contain.text', 'Watchlist Move Series');
  });

  it('copies a library series to tracking and can open the twin', () => {
    cy.intercept('POST', '/api/v1/collection-items/*/*/tracking*').as('copyToTracking');
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Library Copy Series', 'series', 'tt8500004'),
    });
    CollectionPage.visit();

    CollectionPage.getListItemImages().first().click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogCopyTrackingButton().click();
    cy.wait('@copyToTracking').its('response.statusCode').should('eq', 200);
    CollectionPage.getItemDialogOpenInTrackingButton().should('be.visible');
    CollectionPage.getItemDialogRemoveTrackingButton().should('be.visible');

    CollectionPage.closeActiveDialogByOverlay();
    CollectionPage.visitTracking();
    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItems().first().should('contain.text', 'Library Copy Series');
  });

  it('edits tracking book page progress and shows it on the list card', () => {
    cy.intercept('PUT', '/api/v1/collection-items/**').as('updateBookProgress');
    cy.request('POST', '/api/v1/collection-items', {
      ...buildBooksItem('Progress Tracking Book', '9780306406157'),
      listType: 'tracking',
      progressCurrent: 10,
      progressTotal: 100,
    });
    CollectionPage.visitTracking();
    CollectionPage.getListItems().should('contain.text', 'Progress Tracking Book');
    cy.getByTestId('list-item-progress').should('contain.text', '10 / 100');

    CollectionPage.getListItemImages().first().click();
    CollectionPage.getItemDialogBookProgressChip().should('contain.text', '10 / 100');
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogEditButton().click();
    CollectionPage.getItemDialogProgressCurrentInput().clear().type('55');
    CollectionPage.getItemDialogProgressTotalInput().clear().type('200');
    CollectionPage.getItemDialogSaveButton().click();
    cy.wait('@updateBookProgress').its('response.statusCode').should('eq', 200);

    CollectionPage.getItemDialogBookProgressChip().should('contain.text', '55 / 200');
    CollectionPage.closeActiveDialogByOverlay();
    cy.getByTestId('list-item-progress').should('contain.text', '55 / 200');
  });

  it('marks a tracking book completed when page progress becomes equal', () => {
    cy.intercept('PUT', '/api/v1/collection-items/**').as('completeBookProgress');
    cy.on('window:confirm', () => true);
    cy.request('POST', '/api/v1/collection-items', {
      ...buildBooksItem('Complete Progress Book', '9780140328721'),
      listType: 'tracking',
      progressCurrent: 10,
      progressTotal: 100,
    });
    CollectionPage.visitTracking();
    CollectionPage.getListItems().should('contain.text', 'Complete Progress Book');
    CollectionPage.getTrackingCompletedBadges().should('have.length', 0);

    CollectionPage.getListItemImages().first().click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogEditButton().click();
    CollectionPage.getItemDialogProgressCurrentInput().clear().type('100');
    CollectionPage.getItemDialogProgressTotalInput().clear().type('100');
    CollectionPage.getItemDialogSaveButton().click();
    cy.wait('@completeBookProgress').then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.data.item?.progressCurrent).to.equal(100);
      expect(response?.body?.data.item?.progressTotal).to.equal(100);
      expect(response?.body?.data.item?.watchedAt).to.be.a('string').and.not.be.empty;
    });

    CollectionPage.getItemDialogBookProgressChip().should('contain.text', '100 / 100');
    CollectionPage.closeActiveDialogByOverlay();
    CollectionPage.getListItemProgress().should('contain.text', '100 / 100');
    CollectionPage.getTrackingCompletedBadges().should('have.length', 1);
  });

  it('uncompletes a tracking book when total pages is raised above pages read', () => {
    cy.intercept('PUT', '/api/v1/collection-items/**').as('uncompleteBookProgress');
    cy.on('window:confirm', () => true);
    cy.request('POST', '/api/v1/collection-items', {
      ...buildBooksItem('Uncomplete Progress Book', '9780306406157'),
      listType: 'tracking',
      progressCurrent: 100,
      progressTotal: 100,
    });
    CollectionPage.visitTracking();
    CollectionPage.getListItems().should('contain.text', 'Uncomplete Progress Book');
    CollectionPage.getTrackingCompletedBadges().should('have.length', 1);

    CollectionPage.getListItemImages().first().click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogEditButton().click();
    CollectionPage.getItemDialogProgressTotalInput().clear().type('200');
    CollectionPage.getItemDialogSaveButton().click();
    cy.wait('@uncompleteBookProgress').then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.data.item?.progressCurrent).to.equal(100);
      expect(response?.body?.data.item?.progressTotal).to.equal(200);
      expect(response?.body?.data.item?.watchedAt).to.equal(null);
    });

    CollectionPage.getItemDialogBookProgressChip().should('contain.text', '100 / 200');
    CollectionPage.closeActiveDialogByOverlay();
    CollectionPage.getListItemProgress().should('contain.text', '100 / 200');
    CollectionPage.getTrackingCompletedBadges().should('have.length', 0);
  });

  it('keeps save disabled when total pages is lower than pages read', () => {
    cy.on('window:confirm', () => true);
    cy.request('POST', '/api/v1/collection-items', {
      ...buildBooksItem('Invalid Progress Book', '9780140328721'),
      listType: 'tracking',
      progressCurrent: 50,
      progressTotal: 100,
    });
    CollectionPage.visitTracking();
    CollectionPage.getListItemImages().first().click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogEditButton().click();
    CollectionPage.getItemDialogProgressCurrentInput().clear().type('120');
    CollectionPage.getItemDialogProgressTotalInput().clear().type('100');
    CollectionPage.getItemDialogSaveButton().should('be.disabled');
    cy.contains('Total pages must be greater than or equal to pages read.').scrollIntoView().should('be.visible');
  });

  it('recovers save after fixing pages read above total pages', () => {
    cy.intercept('PUT', '/api/v1/collection-items/**').as('recoverBookProgress');
    cy.on('window:confirm', () => true);
    cy.request('POST', '/api/v1/collection-items', {
      ...buildBooksItem('Recover Progress Book', '9780306406157'),
      listType: 'tracking',
      progressCurrent: 50,
      progressTotal: 100,
    });
    CollectionPage.visitTracking();
    CollectionPage.getListItemImages().first().click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogEditButton().click();
    CollectionPage.getItemDialogProgressCurrentInput().clear().type('150');
    CollectionPage.getItemDialogSaveButton().should('be.disabled');
    cy.contains('Total pages must be greater than or equal to pages read.').scrollIntoView().should('be.visible');

    CollectionPage.getItemDialogProgressTotalInput().clear().type('200');
    CollectionPage.getItemDialogSaveButton().should('be.enabled').click();
    cy.wait('@recoverBookProgress').then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.data.item?.progressCurrent).to.equal(150);
      expect(response?.body?.data.item?.progressTotal).to.equal(200);
    });

    CollectionPage.getItemDialogBookProgressChip().should('contain.text', '150 / 200');
    CollectionPage.closeActiveDialogByOverlay();
    cy.getByTestId('list-item-progress').should('contain.text', '150 / 200');
  });

  it('creates a tracking book with page progress from the new-item dialog', () => {
    cy.intercept('POST', '/api/v1/collection-items').as('createTrackingBook');
    CollectionPage.visitTracking();
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAddNewButton().click();

    CollectionPage.getNewItemManualModeButton().click();
    CollectionPage.getNewItemManualContentTypeSelect().select('book');
    CollectionPage.getNewItemManualTitleInput().type('Manual Progress Book');
    CollectionPage.getNewItemManualImdbIdInput().type('9780140328721');
    CollectionPage.getNewItemManualProgressCurrentInput().type('12');
    CollectionPage.getNewItemManualProgressTotalInput().type('240');
    CollectionPage.getNewItemSaveAndCloseButton().should('be.enabled').click();

    cy.wait('@createTrackingBook').then(({ request, response }) => {
      expect(request.body).to.deep.include({
        title: 'Manual Progress Book',
        contentType: 'book',
        listType: 'tracking',
        progressCurrent: 12,
        progressTotal: 240,
      });
      expect(response?.statusCode).to.equal(200);
    });

    CollectionPage.getListItems().should('contain.text', 'Manual Progress Book');
    cy.getByTestId('list-item-progress').should('contain.text', '12 / 240');
  });

  it('saves a library series with copy-to-tracking-as-completed checked', () => {
    const seriesTitle = 'Copy Completed Series';
    cy.intercept('GET', '/api/v1/external-metadata/search*', {
      statusCode: 200,
      body: { data: buildOmdbSearchResult(seriesTitle, 'tt8500005', 'series') },
    }).as('seriesSearch');
    cy.intercept('GET', '/api/v1/external-metadata/items*', {
      statusCode: 200,
      body: { data: buildOmdbItem(seriesTitle, 'tt8500005', 'series') },
    }).as('seriesItem');
    cy.intercept('POST', '/api/v1/collection-items').as('createSeries');
    cy.intercept('POST', '/api/v1/collection-items/*/*/tracking*').as('addTracking');
    cy.intercept('PUT', '/api/v1/collection-items/*/*/tracking/actions/mark-completed*', {
      statusCode: 200,
      body: {
        data: {
          completedEpisodes: [{ season: 1, episode: 1 }],
          lastCompletedEpisode: { season: 1, episode: 1 },
          item: null,
        },
      },
    }).as('markAllCompleted');

    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAddNewButton().click();
    CollectionPage.getNewItemContentSelect().select('series');
    CollectionPage.getNewItemSearchInput().type(seriesTitle);
    cy.wait('@seriesSearch');
    CollectionPage.getNewItemContentOptions().should('have.length.at.least', 1);
    CollectionPage.getNewItemCopyToTrackingAsCompletedCheckbox().check();
    CollectionPage.getNewItemSaveAndCloseButton().click();
    cy.wait('@seriesItem');
    cy.wait('@createSeries').its('response.statusCode').should('eq', 200);
    cy.wait('@addTracking').its('response.statusCode').should('eq', 200);
    cy.wait('@markAllCompleted').its('response.statusCode').should('eq', 200);

    CollectionPage.getListItems().should('contain.text', seriesTitle);
    CollectionPage.visitTracking();
    CollectionPage.getListItems().should('contain.text', seriesTitle);
  });
});

describe('Collection - tag badge filtering', () => {
  const taggedItem = buildCollectionItem('Badge Test Movie', 'movie', 'tt6000001');

  beforeEach(() => {
    cy.autoLogin();
    // Create item with a custom tag
    cy.request('POST', '/api/v1/collection-items', { ...taggedItem, tags: ['#action'] });
    // Enable image badge for the custom tag via API
    cy.request('POST', '/api/v1/users/me/tags', [
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
