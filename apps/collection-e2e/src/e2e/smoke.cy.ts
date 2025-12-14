describe('Collection Tracker smoke test', () => {
  it('loads the client landing page', () => {
    cy.visit('/');
    cy.contains(/collection/i).should('exist');
  });
});
