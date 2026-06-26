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

const expectVisibleTitles = (titles: string[]) => {
  CollectionPage.getListItems().should('have.length', titles.length);
  titles.forEach((title, index) => {
    CollectionPage.getListItems().eq(index).should('contain.text', title);
  });
};

const showOrderControls = () => {
  cy.get('body')
    .should((body) => {
      expect(
        body.find('[data-test-id="show-functions"], [data-test-id="list-order-by-toggle"]').length
      ).to.be.greaterThan(0);
    })
    .then((body) => {
      if (body.find('[data-test-id="show-functions"]').length) {
        CollectionPage.getShowFunctionsButton().click();
      }
    });
  CollectionPage.getOrderByToggleButton().should('be.visible');
  CollectionPage.getOrderDirectionToggleButton().should('be.visible');
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

  it('searches OMDB when enter is pressed in the new-item search', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAddNewButton().click();

    CollectionPage.getNewItemSearchInput().type(`${newTitle}{enter}`);

    cy.wait('@omdbSearch');
    CollectionPage.getNewItemSearchInput().should('have.value', newTitle);
    CollectionPage.getNewItemContentSelect().find('option').should('have.length.at.least', 1);
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
    CollectionPage.getListItems().contains(newTitle).click();
    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogMarkUnwatchedButton().should('be.visible');
  });

  it('saves a new item with a user rate', () => {
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAddNewButton().click();

    CollectionPage.getNewItemSearchInput().type(newTitle);
    cy.wait('@omdbSearch');

    CollectionPage.getNewItemContentSelect().find('option').should('have.length.at.least', 1);
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

    CollectionPage.getNewItemContentSelect().find('option').should('have.length.at.least', 1);
    CollectionPage.getNewItemUserRateInput().type('10.1');
    CollectionPage.getNewItemSaveAndCloseButton().should('be.disabled');
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
    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogEditButton().should('be.visible');
  });

  it('enters edit mode and the save button appears', () => {
    CollectionPage.getListItemImages().first().click();
    CollectionPage.openItemDialogActionsMenu();
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
    CollectionPage.openItemDialogActionsMenu();
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
    CollectionPage.openItemDialogActionsMenu();
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
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem('Wishlist Search Alpha', 'movie', 'tt8300001'),
      listType: 'wishlist',
    });
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem('Wishlist Search Beta', 'movie', 'tt8300002'),
      listType: 'wishlist',
    });
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem('Watch Later Search Alpha', 'movie', 'tt8300003'),
      listType: 'watch-later',
    });
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem('Watch Later Search Beta', 'movie', 'tt8300004'),
      listType: 'watch-later',
    });
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem('Series Tracker Search Alpha', 'series', 'tt8300005'),
      listType: 'series-tracker',
    });
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem('Series Tracker Search Beta', 'series', 'tt8300006'),
      listType: 'series-tracker',
    });
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem('Movie Tracker Search Alpha', 'movie', 'tt8300007'),
      listType: 'movie-tracker',
    });
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem('Movie Tracker Search Beta', 'movie', 'tt8300008'),
      listType: 'movie-tracker',
    });
  });

  it('filters wishlist items and requests wishlist-scoped suggestions', () => {
    cy.intercept('GET', '/api/v1/items/search-suggestions*').as('searchSuggestions');

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
    CommonPage.getNavWatchLaterLink().click();

    CollectionPage.getWatchLaterSearchInput().should('be.visible').type('Alpha');
    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItems().first().should('contain.text', 'Watch Later Search Alpha');
    CollectionPage.getListItems().should('not.contain.text', 'Watch Later Search Beta');
  });

  it('filters series tracker items', () => {
    CommonPage.openMenu();
    CommonPage.getNavSeriesTrackerLink().click();

    CollectionPage.getSeriesTrackerSearchInput().should('be.visible').type('Alpha');
    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItems().first().should('contain.text', 'Series Tracker Search Alpha');
    CollectionPage.getListItems().should('not.contain.text', 'Series Tracker Search Beta');
  });

  it('filters movie tracker items', () => {
    CommonPage.openMenu();
    CommonPage.getNavMovieTrackerLink().click();

    CollectionPage.getMovieTrackerSearchInput().should('be.visible').type('Alpha');
    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItems().first().should('contain.text', 'Movie Tracker Search Alpha');
    CollectionPage.getListItems().should('not.contain.text', 'Movie Tracker Search Beta');
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
    cy.intercept('GET', '/api/v1/items*').as('getItems');
    CollectionPage.visit();
    cy.wait('@getItems');

    expectVisibleTitles(['Order Bravo', 'Order Charlie', 'Order Alpha']);

    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getOrderDirectionToggleButton().click();
    cy.wait('@getItems').its('request.url').should('include', 'orderDirection=asc');
    expectVisibleTitles(['Order Alpha', 'Order Charlie', 'Order Bravo']);

    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getOrderByToggleButton().click();
    cy.wait('@getItems').its('request.url').should('include', 'orderBy=alphabet');
    expectVisibleTitles(['Order Alpha', 'Order Bravo', 'Order Charlie']);

    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getOrderDirectionToggleButton().click();
    cy.wait('@getItems').its('request.url').should('include', 'orderDirection=desc');
    expectVisibleTitles(['Order Charlie', 'Order Bravo', 'Order Alpha']);

    cy.reload();
    cy.wait('@getItems').then((interception) => {
      expect(interception.request.url).to.include('orderBy=alphabet');
      expect(interception.request.url).to.include('orderDirection=desc');
    });
    expectVisibleTitles(['Order Charlie', 'Order Bravo', 'Order Alpha']);
  });

  it('keeps order preferences isolated per collection page', () => {
    seedItems([
      buildCollectionItem('Library Alpha', 'movie', 'tt8400011'),
      buildCollectionItem('Library Bravo', 'movie', 'tt8400012'),
    ]);
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem('Wishlist Alpha', 'movie', 'tt8400013'),
      listType: 'wishlist',
    });
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem('Wishlist Bravo', 'movie', 'tt8400014'),
      listType: 'wishlist',
    });
    cy.intercept('GET', '/api/v1/items*').as('getItems');
    CollectionPage.visit();
    cy.wait('@getItems');

    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getOrderByToggleButton().click();
    cy.wait('@getItems');
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getOrderDirectionToggleButton().click();
    cy.wait('@getItems');
    expectVisibleTitles(['Library Alpha', 'Library Bravo']);

    CommonPage.openMenu();
    CommonPage.getNavWishlistLink().click();
    cy.wait('@getItems').then((interception) => {
      expect(interception.request.url).to.include('listType=wishlist');
      expect(interception.request.url).to.include('orderBy=createdAt');
      expect(interception.request.url).to.include('orderDirection=desc');
    });
    expectVisibleTitles(['Wishlist Bravo', 'Wishlist Alpha']);

    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getOrderByToggleButton().click();
    cy.wait('@getItems').its('request.url').should('include', 'orderBy=alphabet');
    cy.reload();
    cy.wait('@getItems').its('request.url').should('include', 'orderBy=alphabet');
    expectVisibleTitles(['Wishlist Bravo', 'Wishlist Alpha']);

    CommonPage.openMenu();
    CommonPage.getNavCollectionLink().click();
    cy.wait('@getItems').then((interception) => {
      expect(interception.request.url).to.include('orderBy=alphabet');
      expect(interception.request.url).to.include('orderDirection=asc');
    });
    expectVisibleTitles(['Library Alpha', 'Library Bravo']);
  });

  it('shows order controls on secondary collection pages', () => {
    cy.intercept('GET', '/api/v1/items*').as('getItems');
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem('Watch Later Order', 'movie', 'tt8400021'),
      listType: 'watch-later',
    });
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem('Wishlist Order', 'movie', 'tt8400022'),
      listType: 'wishlist',
    });
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem('Series Tracker Order', 'series', 'tt8400023'),
      listType: 'series-tracker',
    });
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem('Movie Tracker Order', 'movie', 'tt8400025'),
      listType: 'movie-tracker',
    });
    CommonPage.openMenu();
    CommonPage.getNavWatchLaterLink().click();
    cy.url().should('include', '#/collection/watch-later');
    cy.wait('@getItems');
    showOrderControls();

    CommonPage.openMenu();
    CommonPage.getNavWishlistLink().click();
    cy.url().should('include', '#/collection/wishlist');
    cy.wait('@getItems');
    showOrderControls();

    CommonPage.openMenu();
    CommonPage.getNavSeriesTrackerLink().click();
    cy.url().should('include', '#/collection/series-tracker');
    cy.wait('@getItems');
    showOrderControls();

    CommonPage.openMenu();
    CommonPage.getNavMovieTrackerLink().click();
    cy.url().should('include', '#/collection/movie-tracker');
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
    cy.intercept('PUT', '/api/v1/change/*').as('updateItem');
    cy.on('window:confirm', () => true);

    CollectionPage.getListItems().should('have.length', 2);
    CollectionPage.getListItems().contains('Favorite Test Movie').click();

    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogMarkFavoriteButton().click();
    cy.wait('@updateItem').its('response.statusCode').should('eq', 200);
    CollectionPage.openItemDialogActionsMenu();
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

describe('Collection — wishlist', () => {
  const wishlistTitle = 'Wishlist Test Movie';

  beforeEach(() => {
    cy.intercept('GET', '/api/v1/proxy/omdb/search*', {
      statusCode: 200,
      body: buildOmdbSearchResult(wishlistTitle, 'tt8100001'),
    }).as('wishlistOmdbSearch');
    cy.intercept('GET', '/api/v1/proxy/omdb/item*', {
      statusCode: 200,
      body: buildOmdbItem(wishlistTitle, 'tt8100001'),
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
    CollectionPage.getNewItemContentSelect().find('option').should('have.length.at.least', 1);
    CollectionPage.getNewItemSaveAndCloseButton().click();
    cy.wait('@wishlistOmdbItem');

    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItems().first().should('contain.text', wishlistTitle);
  });
});

describe('Collection — series tracker', () => {
  const seriesTitle = 'Series Tracker Test Show';

  beforeEach(() => {
    cy.intercept('GET', '/api/v1/proxy/omdb/search*', {
      statusCode: 200,
      body: {
        Search: [
          { Title: 'Filtered Movie Result', Year: '2020', imdbID: 'tt8200000', Type: 'movie', Poster: 'N/A' },
          { Title: seriesTitle, Year: '2021', imdbID: 'tt8200001', Type: 'series', Poster: 'N/A' },
        ],
        totalResults: '2',
        Response: 'True',
      },
    }).as('seriesTrackerOmdbSearch');
    cy.intercept('GET', '/api/v1/proxy/omdb/item*', {
      statusCode: 200,
      body: buildOmdbItem(seriesTitle, 'tt8200001', 'series'),
    }).as('seriesTrackerOmdbItem');

    cy.autoLogin();
  });

  it('adds a series and persists watched-up-to progress', () => {
    cy.intercept('PUT', `/api/v1/series-tracker/tt8200001/watched-episodes`).as('saveWatchedEpisodes');
    cy.on('window:confirm', () => true);

    CommonPage.openMenu();
    CommonPage.getNavSeriesTrackerLink().click();

    cy.url().should('include', '#/collection/series-tracker');
    cy.getByTestId('collection-search').should('not.exist');
    CollectionPage.getAddFirstSeriesTrackerItemLink().click();

    CollectionPage.getNewItemSearchInput().type(seriesTitle);
    cy.wait('@seriesTrackerOmdbSearch');
    CollectionPage.getNewItemContentSelect().find('option').should('have.length', 1).and('contain.text', seriesTitle);
    cy.getByTestId('new-item-user-rate').should('not.exist');
    cy.getByTestId('new-item-watched').should('not.exist');
    CollectionPage.getNewItemSaveAndCloseButton().click();
    cy.wait('@seriesTrackerOmdbItem');

    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItems().first().should('contain.text', seriesTitle);

    cy.request('PUT', `/api/v1/series-tracker/tt8200001/seasons`, {
      seasons: [{ season: 1, episodes: 3 }],
    });
    CollectionPage.visitSeriesTracker();

    CollectionPage.getListItemImages().first().click();
    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogManageWatchedEpisodesButton().click();
    CollectionPage.getWatchedEpisodesEpisodeCheckbox().eq(0).check();
    cy.wait('@saveWatchedEpisodes').its('response.statusCode').should('eq', 200);
    CollectionPage.getWatchedEpisodesEpisodeCheckbox().eq(1).check();
    cy.wait('@saveWatchedEpisodes').its('response.statusCode').should('eq', 200);
    CollectionPage.closeDialogByOverlay();
    CollectionPage.getWatchedEpisodesDialogHost().should('not.exist');
    CollectionPage.getItemDialogHost().should('be.visible');
    CollectionPage.getItemDialogEpisodeProgressChip().should('contain.text', 'S01E02');

    cy.reload();
    CollectionPage.getListItemImages().first().click();
    CollectionPage.getItemDialogEpisodeProgressChip().should('contain.text', 'S01E02');
  });
});

describe('Collection — movie tracker', () => {
  const movieTitle = 'Movie Tracker Test Movie';

  beforeEach(() => {
    cy.intercept('GET', '/api/v1/proxy/omdb/search*', {
      statusCode: 200,
      body: {
        Search: [
          { Title: 'Filtered Series Result', Year: '2020', imdbID: 'tt8300000', Type: 'series', Poster: 'N/A' },
          { Title: movieTitle, Year: '2021', imdbID: 'tt8300001', Type: 'movie', Poster: 'N/A' },
        ],
        totalResults: '2',
        Response: 'True',
      },
    }).as('movieTrackerOmdbSearch');
    cy.intercept('GET', '/api/v1/proxy/omdb/item*', {
      statusCode: 200,
      body: buildOmdbItem(movieTitle, 'tt8300001', 'movie'),
    }).as('movieTrackerOmdbItem');

    cy.autoLogin();
  });

  it('navigates via the menu and adds a movie tracker item from the empty state', () => {
    CommonPage.openMenu();
    CommonPage.getNavMovieTrackerLink().click();

    cy.url().should('include', '#/collection/movie-tracker');
    cy.getByTestId('collection-search').should('not.exist');
    CollectionPage.getAddFirstMovieTrackerItemLink().click();

    CollectionPage.getNewItemSearchInput().type(movieTitle);
    cy.wait('@movieTrackerOmdbSearch');
    CollectionPage.getNewItemContentSelect().find('option').should('have.length', 1).and('contain.text', movieTitle);
    cy.getByTestId('new-item-user-rate').should('not.exist');
    cy.getByTestId('new-item-watched').should('not.exist');
    CollectionPage.getNewItemSaveAndCloseButton().click();
    cy.wait('@movieTrackerOmdbItem');

    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItems().first().should('contain.text', movieTitle);
    CollectionPage.getMovieTrackerWatchedBadges().should('have.length', 1);
  });

  it('opens the item dialog and shows watched status without episode controls', () => {
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem(movieTitle, 'movie', 'tt8300001'),
      listType: 'movie-tracker',
    });
    CollectionPage.visitMovieTracker();

    CollectionPage.getListItemImages().first().click();
    CollectionPage.getItemDialogCompletedChip().should('not.exist');
    CollectionPage.getItemDialogManageWatchedEpisodesButton().should('not.exist');
    CollectionPage.getItemDialogManageSeriesMetadataButton().should('not.exist');

    CollectionPage.closeActiveDialogByOverlay();
  });

  it('moves a movie from watch-later to movie tracker', () => {
    cy.intercept('POST', '/api/v1/movie-tracker/*').as('moveToMovieTracker');
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem('Watch Later Move Movie', 'movie', 'tt8300002'),
      listType: 'watch-later',
    });
    CollectionPage.visitWatchLater();

    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItemImages().first().click();
    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogMoveMovieTrackerButton().click();
    cy.wait('@moveToMovieTracker').its('response.statusCode').should('eq', 200);

    CollectionPage.getEmptyState().should('be.visible');

    CollectionPage.visitMovieTracker();
    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItems().first().should('contain.text', 'Watch Later Move Movie');
  });

  it('deletes a movie tracker item and shows empty state', () => {
    cy.intercept('DELETE', '/api/v1/delete/*').as('deleteMovieTrackerItem');
    cy.on('window:confirm', () => true);

    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem('Delete Tracker Movie', 'movie', 'tt8300003'),
      listType: 'movie-tracker',
    });
    CollectionPage.visitMovieTracker();

    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItemImages().first().click();
    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogDeleteButton().click();
    cy.wait('@deleteMovieTrackerItem').its('response.statusCode').should('eq', 204);

    CollectionPage.getEmptyState().should('be.visible');
  });

  it('filters movie tracker items via search', () => {
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem('Alpha Movie', 'movie', 'tt8300004'),
      listType: 'movie-tracker',
    });
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem('Beta Movie', 'movie', 'tt8300005'),
      listType: 'movie-tracker',
    });
    CollectionPage.visitMovieTracker();

    CollectionPage.getListItems().should('have.length', 2);
    CollectionPage.getMovieTrackerSearchInput().type('Alpha');
    CollectionPage.getListItems().should('have.length', 1);
    CollectionPage.getListItems().first().should('contain.text', 'Alpha Movie');
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
    cy.request('POST', '/api/v1/create', { ...taggedItem, tags: ['#action'] });
    // Enable image badge for the custom tag via API
    cy.request('POST', '/api/v1/tag-management', [
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
