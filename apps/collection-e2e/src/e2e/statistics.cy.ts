import { buildCollectionItem } from '../fixtures/collection-item';
import { StatisticsPage } from '../page-objects/statistics.po';

describe('Statistics — empty collection', () => {
  beforeEach(() => {
    cy.autoLogin();
    StatisticsPage.visit();
  });

  it('shows the empty state message when there are no items', () => {
    StatisticsPage.getEmptyMessage().should('be.visible');
  });
});

describe('Statistics — with movies and series', () => {
  const movieOne = buildCollectionItem('Stats Movie One', 'movie');
  const movieTwo = buildCollectionItem('Stats Movie Two', 'movie');
  const seriesOne = buildCollectionItem('Stats Series One', 'series');

  beforeEach(() => {
    cy.autoLogin();
    cy.request('POST', '/api/v1/create', { name: movieOne.name, content: movieOne.content });
    cy.request('POST', '/api/v1/create', { name: movieTwo.name, content: movieTwo.content });
    cy.request('POST', '/api/v1/create', { name: seriesOne.name, content: seriesOne.content });
    StatisticsPage.visit();
  });

  it('shows the summary section', () => {
    StatisticsPage.getSummary().should('be.visible');
  });

  it('shows the correct total count', () => {
    StatisticsPage.getSummaryAll().should('contain.text', '3');
  });

  it('shows the correct movies count', () => {
    StatisticsPage.getSummaryMovies().should('contain.text', '2');
  });

  it('shows the correct series count', () => {
    StatisticsPage.getSummarySeries().should('contain.text', '1');
  });

  it('shows tag buttons for #movie and #series', () => {
    StatisticsPage.getTagButton('#movie').should('be.visible');
    StatisticsPage.getTagButton('#series').should('be.visible');
  });

  it('shows the tags-empty message when no tag is selected', () => {
    StatisticsPage.getTagsEmpty().should('be.visible');
  });

  it('hides the chart canvas when no tag is selected', () => {
    StatisticsPage.getChart().should('not.be.visible');
  });

  it('shows the chart when a tag button is clicked', () => {
    StatisticsPage.getTagButton('#movie').click();
    StatisticsPage.getChart().should('be.visible');
  });

  it('hides the chart again when the selected tag is deselected', () => {
    StatisticsPage.getTagButton('#movie').click();
    StatisticsPage.getChart().should('be.visible');
    StatisticsPage.getTagButton('#movie').click();
    StatisticsPage.getChart().should('not.be.visible');
  });

  it('can select multiple tags and shows the chart', () => {
    StatisticsPage.getTagButton('#movie').click();
    StatisticsPage.getTagButton('#series').click();
    StatisticsPage.getChart().should('be.visible');
  });
});
