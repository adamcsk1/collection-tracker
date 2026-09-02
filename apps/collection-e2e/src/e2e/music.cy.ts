import { buildMusicBrainzItem, buildMusicBrainzSearchResult, buildMusicItem } from '../fixtures/musicbrainz';
import { CollectionPage } from '../page-objects/collection.po';
import { CommonPage } from '../page-objects/common.po';
import { MusicPage } from '../page-objects/music.po';
import { SettingsPage } from '../page-objects/settings.po';

describe('Music', () => {
  beforeEach(() => {
    cy.autoLogin();
  });

  it('toggles music filter while keeping the direct route accessible', () => {
    CollectionPage.visit();
    cy.getByTestId('show-functions').click();
    cy.getByTestId('collection-media-chip-album').should('be.visible');

    SettingsPage.visitFeatures();
    cy.intercept('POST', '/api/v1/users/me/settings').as('saveSettings');
    SettingsPage.getFeatureMusicCheckbox().uncheck();
    cy.wait('@saveSettings').its('response.statusCode').should('eq', 200);

    CollectionPage.visit();
    cy.getByTestId('collection-media-chip-album').should('not.exist');
    CommonPage.openMenu();
    CommonPage.getMenuNavItem('nav-music').should('not.exist');
    CommonPage.closeMenu();

    MusicPage.visit();
    cy.url().should('include', '#/collection/music');
    MusicPage.getEmptyState().should('be.visible');

    SettingsPage.visitFeatures();
    SettingsPage.getFeatureMusicCheckbox().check();
    cy.wait('@saveSettings').its('response.statusCode').should('eq', 200);
    CollectionPage.visit();
    cy.getByTestId('collection-media-chip-album').should('be.visible');
  });

  it('searches MusicBrainz, creates an album, shows its details, and deletes it', () => {
    const title = 'The E2E Album';
    const mbid = 'f509c5ff-ad54-4dde-b61e-24f750965835';
    cy.intercept('GET', '/api/v1/external-metadata/search*provider=musicbrainz*', {
      statusCode: 200,
      body: { data: buildMusicBrainzSearchResult(title, mbid) },
    }).as('musicBrainzSearch');
    cy.intercept('GET', '/api/v1/external-metadata/items*externalIdentitySource=musicbrainz*', {
      statusCode: 200,
      body: { data: buildMusicBrainzItem(title, mbid) },
    }).as('musicBrainzItem');
    cy.intercept('POST', '/api/v1/collection-items').as('createAlbum');
    cy.intercept('DELETE', '/api/v1/collection-items/**').as('deleteAlbum');

    MusicPage.visit();
    MusicPage.getAddFirstItemLink().click();
    MusicPage.getNewItemSearchInput().type(title);
    cy.wait('@musicBrainzSearch');
    MusicPage.getNewItemContentOptions().should('have.length', 1).and('contain.text', title);
    MusicPage.getNewItemSaveAndCloseButton().click();
    cy.wait('@musicBrainzItem');
    cy.wait('@createAlbum').then(({ request, response }) => {
      expect(request.body).to.deep.include({
        title,
        contentType: 'album',
        externalProvider: 'musicbrainz',
        externalItemId: mbid,
        listType: 'music',
        actors: 'Artist One, Artist Two',
      });
      expect(request.body.externalIds).to.deep.equal([{ source: 'musicbrainz', id: mbid }]);
      expect(response?.statusCode).to.equal(200);
    });

    MusicPage.getListItemTitles().should('have.length', 1).and('contain.text', title);
    MusicPage.getListItemImages().first().click();
    MusicPage.getItemDialog().should('contain.text', title).and('contain.text', 'Artist One, Artist Two');
    MusicPage.getItemDialogMbid().should('contain.text', mbid);

    cy.on('window:confirm', () => true);
    MusicPage.getItemDialogDeleteButton().click();
    cy.wait('@deleteAlbum').its('response.statusCode').should('eq', 204);
    MusicPage.getEmptyState().should('be.visible');
  });

  it('adds a music list item manually by MBID and persists it after reload', () => {
    const title = 'Manual E2E Album';
    const mbid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const artists = 'Manual Artist';
    cy.intercept('POST', '/api/v1/collection-items').as('createManualAlbum');

    MusicPage.visit();
    MusicPage.getShowFunctionsButton().click();
    MusicPage.getAddNewButton().click();

    MusicPage.getNewItemManualModeButton().click();
    MusicPage.getNewItemManualTitleInput().type(title);
    MusicPage.getNewItemManualMbidInput().type(mbid);
    MusicPage.getNewItemManualArtistsInput().type(artists);
    MusicPage.getNewItemSaveAndCloseButton().should('be.enabled').click();

    cy.wait('@createManualAlbum').then(({ request, response }) => {
      expect(request.body).to.deep.include({
        title,
        contentType: 'album',
        externalProvider: 'musicbrainz',
        externalItemId: mbid,
        listType: 'music',
        actors: artists,
        favorite: false,
      });
      expect(request.body.externalIds).to.deep.equal([{ source: 'musicbrainz', id: mbid }]);
      expect(response?.statusCode).to.equal(200);
    });

    MusicPage.getListItemTitles().should('have.length', 1).and('contain.text', title);
    MusicPage.getListItemImages().first().click();
    MusicPage.getItemDialog().should('contain.text', title).and('contain.text', artists);
    MusicPage.getItemDialogMbid().should('contain.text', mbid);

    cy.intercept('GET', '/api/v1/collection-items*').as('reloadMusic');
    cy.reload();
    cy.wait('@reloadMusic');
    MusicPage.getListItemTitles().should('have.length', 1).and('contain.text', title);
  });

  it('keeps manual album save disabled for invalid MBID or missing required fields', () => {
    MusicPage.visit();
    MusicPage.getShowFunctionsButton().click();
    MusicPage.getAddNewButton().click();

    MusicPage.getNewItemManualModeButton().click();
    MusicPage.getNewItemManualTitleInput().type('Manual Album Title');
    MusicPage.getNewItemSaveAndCloseButton().should('be.disabled');

    MusicPage.getNewItemManualMbidInput().type('not-an-mbid');
    MusicPage.getNewItemSaveAndCloseButton().should('be.disabled');

    MusicPage.getNewItemManualMbidInput().clear().type('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    MusicPage.getNewItemSaveAndCloseButton().should('be.enabled');
  });

  it('clears all music list data from manage tracker data settings', () => {
    cy.request('POST', '/api/v1/collection-items', buildMusicItem('Album To Clear'));
    cy.intercept('DELETE', '/api/v1/collection-items/music').as('clearMusic');
    cy.on('window:confirm', () => true);

    SettingsPage.visitManageTrackerData();
    SettingsPage.getRemoveAllTrackedMusicDataButton().click();
    cy.wait('@clearMusic').its('response.statusCode').should('eq', 200);

    MusicPage.visit();
    MusicPage.getEmptyState().should('be.visible');
  });
});
