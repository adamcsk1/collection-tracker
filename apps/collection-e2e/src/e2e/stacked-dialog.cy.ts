import { buildCollectionItem } from '../fixtures/collection-item';
import { CollectionPage } from '../page-objects/collection.po';

const waitForTrackingItem = (imdbId: string) => {
  cy.wait('@getTrackingItems')
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
      listType: 'tracking',
    });
    cy.intercept('GET', '/api/v1/items?*listType=tracking*').as('getTrackingItems');
    CollectionPage.visitTracking();
    waitForTrackingItem(imdbId);
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
    CollectionPage.getItemDialogManageCompletedEpisodesButton().click();
    CollectionPage.getCompletedEpisodesDialog().should('be.visible');
    expectDialogHostStacked(CollectionPage.getItemDialogComponentHost());
    expectDialogHostStackTop(CollectionPage.getCompletedEpisodesDialogComponentHost());
    expectActiveDialogFocused();

    CollectionPage.getCompletedEpisodesManageSeasonMetadataButton().click();
    CollectionPage.getSeriesMetadataDialog().should('be.visible');
    expectDialogHostStacked(CollectionPage.getItemDialogComponentHost());
    expectDialogHostStacked(CollectionPage.getCompletedEpisodesDialogComponentHost());
    expectDialogHostStackTop(CollectionPage.getSeriesMetadataDialogComponentHost());
    expectActiveDialogFocused();

    CollectionPage.closeActiveDialogByOverlay();
    CollectionPage.getSeriesMetadataDialogHost().should('not.exist');
    expectDialogHostStacked(CollectionPage.getItemDialogComponentHost());
    expectDialogHostStackTop(CollectionPage.getCompletedEpisodesDialogComponentHost());
    expectActiveDialogFocused();

    CollectionPage.closeActiveDialogByOverlay();
    CollectionPage.getCompletedEpisodesDialogHost().should('not.exist');
    expectDialogHostActive(CollectionPage.getItemDialogComponentHost());
    expectActiveDialogFocused();
  });
});
