export const AboutPage = {
  visit: () => cy.visit('/client/#/about'),

  getTitle: () => cy.getByTestId('about-title'),
  getBuild: () => cy.getByTestId('about-build'),
  getVersion: () => cy.getByTestId('about-version'),
  getGithubLink: () => cy.getByTestId('about-github-link'),
  getHealthLink: () => cy.getByTestId('about-health-link'),
  getApiDocsLink: () => cy.getByTestId('about-api-docs-link').scrollIntoView(),
};
