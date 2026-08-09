import { CommonPage } from '../page-objects/common.po';
import { SignInPage } from '../page-objects/sign-in.po';
import { SignUpPage } from '../page-objects/sign-up.po';

describe('Auth — Sign-up', () => {
  beforeEach(() => {
    SignUpPage.visit();
  });

  it('shows the sign-up form', () => {
    SignUpPage.getUsernameInput().should('be.visible');
    SignUpPage.getSubmitButton().should('be.visible').and('be.disabled');
    SignUpPage.getSignInLink().should('be.visible');
  });

  it('submit is enabled once a valid username is entered', () => {
    SignUpPage.fillUsername('newuser123');
    SignUpPage.getSubmitButton().should('not.be.disabled');
  });

  it('reveals the generated secret after successful sign-up', () => {
    SignUpPage.fillUsername(`signup_test_${Date.now()}`);
    SignUpPage.submit();
    SignUpPage.getSecretValue().should('be.visible').and('not.be.empty');
  });

  it('navigates to sign-in via the back link', () => {
    SignUpPage.getSignInLink().click();
    cy.url().should('include', '/sign-in');
  });
});

describe('Auth — Sign-in', () => {
  beforeEach(() => {
    SignInPage.visit();
  });

  it('shows the sign-in form with all required fields', () => {
    SignInPage.getUsernameInput().should('be.visible');
    SignInPage.getTokenInput().should('be.visible');
    SignInPage.getSubmitButton().should('be.visible').and('be.disabled');
    SignInPage.getSignUpLink().should('be.visible');
  });

  it('submit becomes enabled when both fields are filled', () => {
    SignInPage.fillUsername('testuser');
    SignInPage.fillToken('testtoken');
    SignInPage.getSubmitButton().should('not.be.disabled');
  });

  it('toggles secret visibility', () => {
    SignInPage.getTokenInput().should('have.attr', 'type', 'password');
    SignInPage.getToggleSecretButton().click();
    SignInPage.getTokenInput().should('have.attr', 'type', 'text');
    SignInPage.getToggleSecretButton().click();
    SignInPage.getTokenInput().should('have.attr', 'type', 'password');
  });

  it('signs in with a freshly created user and navigates to the client', () => {
    cy.autoLogin();
    cy.url().should('include', '/client/');
  });

  it('navigates to sign-up page via link', () => {
    SignInPage.getSignUpLink().click();
    cy.url().should('include', '/sign-up');
  });
});

describe('Auth — API URL switch', () => {
  it('reveals the API URL input when "Change API URL" is clicked', () => {
    SignInPage.visit();
    cy.getByTestId('sign-in-api-url').should('not.exist');
    SignInPage.getChangeApiUrlButton().click();
    SignInPage.getApiUrlInput().should('be.visible');
  });

  it('accepts a typed API URL value', () => {
    SignInPage.visit();
    SignInPage.getChangeApiUrlButton().click();
    SignInPage.getApiUrlInput().clear().type('/api/v2');
    SignInPage.getApiUrlInput().should('have.value', '/api/v2');
  });
});

describe('Auth — Language and theme override from login', () => {
  beforeEach(() => {
    SignInPage.visit();
  });

  it('language select is visible and has options', () => {
    SignInPage.getLanguageSelect().should('be.visible');
    SignInPage.getLanguageSelect().find('option').should('have.length.at.least', 1);
  });

  it('theme select is visible and has options', () => {
    SignInPage.getThemeSelect().should('be.visible');
    SignInPage.getThemeSelect().find('option').should('have.length.at.least', 1);
  });

  it('language selection persists across page reload', () => {
    SignInPage.getLanguageSelect()
      .find('option')
      .then(($options) => {
        if ($options.length > 1) {
          const secondValue = $options.eq(1).val() as string;
          SignInPage.getLanguageSelect().select(secondValue);
          SignInPage.visit();
          SignInPage.getLanguageSelect().should('have.value', secondValue);
        }
      });
  });

  it('theme selection persists across page reload', () => {
    SignInPage.getThemeSelect()
      .find('option')
      .then(($options) => {
        if ($options.length > 1) {
          const secondValue = $options.eq(1).val() as string;
          SignInPage.getThemeSelect().select(secondValue);
          SignInPage.visit();
          SignInPage.getThemeSelect().should('have.value', secondValue);
        }
      });
  });
});

describe('Auth - Logout', () => {
  beforeEach(() => {
    cy.autoLogin();
  });

  it('logs the user out and redirects to the login page', () => {
    cy.intercept('DELETE', '/api/v1/auth/session').as('logoutRequest');

    CommonPage.openMenu();
    CommonPage.getNavLogoutLink().click();

    cy.wait('@logoutRequest').its('response.statusCode').should('eq', 204);
    cy.url().should('include', '/login/');
  });
});
