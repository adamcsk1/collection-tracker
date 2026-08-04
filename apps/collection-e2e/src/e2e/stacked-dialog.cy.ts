import { buildCollectionItem } from '../fixtures/collection-item';
import { CollectionPage } from '../page-objects/collection.po';

const waitForWatchingItem = (imdbId: string) => {
  cy.wait('@getWatchingItems')
    .its('response.body.items')
    .should((items: Array<{ IMDbId: string }>) => {
      expect(items.some((item) => item.IMDbId === imdbId)).to.eq(true);
    });
};

const expectDialogHostActive = (host: Cypress.Chainable<JQuery<HTMLElement>>) => {
  host.should((element) => {
    expect(element).not.to.have.class('dialog-stacked');
    expect(element).not.to.have.attr('inert');
    expect(element).not.to.have.attr('aria-hidden');
  });
};

const expectDialogHostStacked = (host: Cypress.Chainable<JQuery<HTMLElement>>) => {
  host.should((element) => {
    expect(element).to.have.class('dialog-stacked');
    expect(element).to.have.attr('inert');
    expect(element).to.have.attr('aria-hidden', 'true');
  });
};

const expectDialogHostStackTop = (host: Cypress.Chainable<JQuery<HTMLElement>>) => {
  host.should((element) => {
    expect(element).to.have.class('dialog-stack-top');
    expect(element).not.to.have.class('dialog-stacked');
    expect(element).not.to.have.attr('inert');
    expect(element).not.to.have.attr('aria-hidden');
  });
};

const expectActiveDialogFocused = () => {
  CollectionPage.getActiveDialogFrame().then((dialogFrame) => {
    CollectionPage.getFocusedElement().should((focusedElement) => {
      expect(dialogFrame[0].contains(focusedElement[0]) || dialogFrame[0] === focusedElement[0]).to.eq(true);
    });
  });
};

describe('Stacked dialogs', () => {
  const imdbId = 'tt8300010';
  const seriesTitle = 'Stacked Dialog Test Show';

  beforeEach(() => {
    cy.autoLogin();
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem(seriesTitle, 'series', imdbId),
      listType: 'watching',
    });
    cy.intercept('GET', '/api/v1/items?*listType=watching*').as('getWatchingItems');
    CollectionPage.visitWatching();
    waitForWatchingItem(imdbId);
  });

  it('keeps only the top dialog interactive across every app-supported stack depth', () => {
    CollectionPage.getListItems().contains(seriesTitle).click();
    CollectionPage.getItemDialogHost().should('be.visible');
    expectDialogHostActive(CollectionPage.getItemDialogComponentHost());
    expectActiveDialogFocused();

    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogManageSeriesMetadataButton().click();
    CollectionPage.getSeriesMetadataDialog().should('be.visible');
    expectDialogHostStacked(CollectionPage.getItemDialogComponentHost());
    expectDialogHostStackTop(CollectionPage.getSeriesMetadataDialogComponentHost());
    expectActiveDialogFocused();

    CollectionPage.closeActiveDialogByOverlay();
    CollectionPage.getSeriesMetadataDialogHost().should('not.exist');
    expectDialogHostActive(CollectionPage.getItemDialogComponentHost());
    expectActiveDialogFocused();

    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogManageWatchedEpisodesButton().click();
    CollectionPage.getWatchedEpisodesDialog().should('be.visible');
    expectDialogHostStacked(CollectionPage.getItemDialogComponentHost());
    expectDialogHostStackTop(CollectionPage.getWatchedEpisodesDialogComponentHost());
    expectActiveDialogFocused();

    CollectionPage.getWatchedEpisodesManageSeasonMetadataButton().click();
    CollectionPage.getSeriesMetadataDialog().should('be.visible');
    expectDialogHostStacked(CollectionPage.getItemDialogComponentHost());
    expectDialogHostStacked(CollectionPage.getWatchedEpisodesDialogComponentHost());
    expectDialogHostStackTop(CollectionPage.getSeriesMetadataDialogComponentHost());
    expectActiveDialogFocused();

    CollectionPage.closeActiveDialogByOverlay();
    CollectionPage.getSeriesMetadataDialogHost().should('not.exist');
    expectDialogHostStacked(CollectionPage.getItemDialogComponentHost());
    expectDialogHostStackTop(CollectionPage.getWatchedEpisodesDialogComponentHost());
    expectActiveDialogFocused();

    CollectionPage.closeActiveDialogByOverlay();
    CollectionPage.getWatchedEpisodesDialogHost().should('not.exist');
    expectDialogHostActive(CollectionPage.getItemDialogComponentHost());
    expectActiveDialogFocused();
  });
});
