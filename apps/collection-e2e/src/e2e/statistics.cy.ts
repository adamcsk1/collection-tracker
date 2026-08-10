import { buildCollectionItem } from '../fixtures/collection-item';
import { buildBooksItem } from '../fixtures/openlibrary';
import { StatisticsPage } from '../page-objects/statistics.po';

describe('Statistics — empty collection', () => {
  it('shows the empty state', () => {
    cy.autoLogin();
    StatisticsPage.visit();

    StatisticsPage.getEmptyMessage().should('be.visible');
  });
});

describe('Statistics — scoped collection', () => {
  beforeEach(() => {
    cy.autoLogin();
    cy.window().then((window) => window.localStorage.removeItem('CT.StatisticsSelectedTags'));
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Statistics Movie One', 'movie', 'tt9000001'),
      tags: ['#movie-only', '#shared'],
      favorite: true,
    });
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Statistics Movie Two', 'movie', 'tt9000002'),
      tags: ['#movie-only'],
    });
    cy.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Statistics Series', 'series', 'tt9000003'),
      tags: ['#series-only'],
    });
    cy.request('POST', '/api/v1/collection-items', {
      ...buildBooksItem('Statistics Book In Progress', '9780306406157'),
      tags: ['#book-only', '#shared'],
      favorite: true,
    });
    cy.request('POST', '/api/v1/collection-items', {
      ...buildBooksItem('Statistics Book Unread', '9780140328721'),
      tags: ['#book-only'],
    });
    cy.request('POST', '/api/v1/collection-items', {
      ...buildBooksItem('Statistics Book In Progress', '9780306406157'),
      listType: 'tracking',
      progressCurrent: 50,
      progressTotal: 100,
    });
    StatisticsPage.visit();
    StatisticsPage.getSummary().should('be.visible');
  });

  it('shows only limited summary cards and combined tags in all mode', () => {
    StatisticsPage.getScopeChip('all').should('have.attr', 'aria-pressed', 'true');
    StatisticsPage.getSummaryCard('all').should('contain.text', '5');
    StatisticsPage.getSummaryCard('movies').should('contain.text', '2');
    StatisticsPage.getSummaryCard('series').should('contain.text', '1');
    StatisticsPage.getSummaryCard('books').should('contain.text', '2');
    StatisticsPage.getSummaryCard('favorites').should('contain.text', '2');
    StatisticsPage.getSummaryCard('watched-movies').should('not.exist');
    StatisticsPage.getSummaryCard('tracked-series').should('not.exist');
    StatisticsPage.getSummaryCard('read-books').should('not.exist');
    StatisticsPage.getSummaryCard('wishlist').should('not.exist');
    StatisticsPage.getSummaryCard('up-next').should('not.exist');
    StatisticsPage.openTagsDetails();
    StatisticsPage.getTag('#movie-only').scrollIntoView().should('be.visible');
    StatisticsPage.getTag('#series-only').scrollIntoView().should('be.visible');
    StatisticsPage.getTag('#book-only').scrollIntoView().should('be.visible');
    StatisticsPage.getOverviewChartCard().scrollIntoView().should('be.visible');
    StatisticsPage.getTagChartCard().should('have.class', 'chart-hidden').and('have.css', 'position', 'absolute');
    StatisticsPage.getRatingChartCard().should('have.class', 'chart-hidden').and('have.css', 'position', 'absolute');
  });

  it('keeps the media type chooser visible while statistics content scrolls', () => {
    StatisticsPage.getScrollContainer()
      .then(($container) => {
        expect($container[0].scrollHeight).to.be.greaterThan($container[0].clientHeight);
      })
      .scrollTo('bottom');

    StatisticsPage.getScopeChip('all').should('be.visible');
    StatisticsPage.getScrollContainer().should(($container) => {
      expect($container[0].scrollTop).to.be.greaterThan(0);
    });
  });

  it('shows movie-focused cards and movie tags in movie mode', () => {
    StatisticsPage.selectScope('movie');

    StatisticsPage.getScopeChip('movie').should('have.attr', 'aria-pressed', 'true');
    StatisticsPage.getSummaryCard('movies').should('contain.text', '2');
    StatisticsPage.getSummaryCard('favorites').should('contain.text', '1');
    StatisticsPage.getSummaryCard('watched-movies').should('exist');
    StatisticsPage.getSummaryCard('unwatched-movies').should('exist');
    StatisticsPage.getSummaryCard('all').should('not.exist');
    StatisticsPage.getSummaryCard('series').should('not.exist');
    StatisticsPage.getSummaryCard('books').should('not.exist');
    StatisticsPage.openTagsDetails();
    StatisticsPage.getTag('#movie-only').scrollIntoView().should('be.visible');
    StatisticsPage.getTag('#series-only').should('not.exist');
    StatisticsPage.getTag('#book-only').should('not.exist');
    StatisticsPage.getRatingChartCard().should('exist');
  });

  it('shows series-focused cards and navigates tracked series to tracking', () => {
    StatisticsPage.selectScope('series');

    StatisticsPage.getScopeChip('series').should('have.attr', 'aria-pressed', 'true');
    StatisticsPage.getSummaryCard('series').should('contain.text', '1');
    StatisticsPage.getSummaryCard('favorites').should('contain.text', '0');
    StatisticsPage.getSummaryCard('tracked-series').should('exist');
    StatisticsPage.getSummaryCard('untracked-series').should('contain.text', '1');
    StatisticsPage.getSummaryCard('completed-series').should('exist');
    StatisticsPage.getSummaryCard('in-progress-series').should('exist');
    StatisticsPage.openTagsDetails();
    StatisticsPage.getTag('#series-only').scrollIntoView().should('be.visible');
    StatisticsPage.getTag('#movie-only').should('not.exist');

    StatisticsPage.getSummaryCard('tracked-series').click();
    cy.url().should('include', '#/collection/tracking');
    cy.url().should('include', 'type=series');
  });

  it('shows book-specific cards and only book tags in book mode', () => {
    StatisticsPage.selectScope('book');

    StatisticsPage.getScopeChip('book').should('have.attr', 'aria-pressed', 'true');
    StatisticsPage.getSummaryCard('books').should('contain.text', '2');
    StatisticsPage.getSummaryCard('favorites').should('contain.text', '1');
    StatisticsPage.getSummaryCard('read-books').should('contain.text', '0');
    StatisticsPage.getSummaryCard('unread-books').should('contain.text', '1');
    StatisticsPage.getSummaryCard('in-progress-books').should('contain.text', '1');
    StatisticsPage.getSummaryCard('movies').should('not.exist');
    StatisticsPage.getSummaryCard('series').should('not.exist');
    StatisticsPage.openTagsDetails();
    StatisticsPage.getTag('#book-only').scrollIntoView().should('be.visible');
    StatisticsPage.getTag('#shared').scrollIntoView().should('be.visible');
    StatisticsPage.getTag('#movie-only').should('not.exist');
    StatisticsPage.getTag('#series-only').should('not.exist');

    StatisticsPage.getSummaryCard('books').click();
    cy.url().should('include', '#/collection/books');
  });
});
