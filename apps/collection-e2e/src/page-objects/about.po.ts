import { CommonPage } from './common.po';

export const AboutPage = {
  visit: () => {
    cy.visit('/client/#/collection/library');
    CommonPage.openMenu();
    CommonPage.getNavAboutLink().click();
  },

  getTitle: () => cy.getByTestId('about-title'),
  getBuild: () => cy.getByTestId('about-build'),
  getVersion: () => cy.getByTestId('about-version'),
  getGithubLink: () => cy.getByTestId('about-github-link').scrollIntoView(),
  getHealthLink: () => cy.getByTestId('about-health-link').scrollIntoView(),
  getApiDocsLink: () => cy.getByTestId('about-api-docs-link').scrollIntoView(),
};
