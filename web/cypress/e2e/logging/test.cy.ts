import { TestIds } from '../../../src/test-ids';
import { testData } from '../../fixtures/data-test';
import { coreObsLogsTests } from './testUtils.cy';

describe('AdminConsole: Admin in ObserveLogs', { tags: ['@admin'] }, () => {
  before( function() {
    cy.uiLoginAsClusterAdminForUser("First");
    cy.switchToAdmConsole();
  });

  beforeEach( function() {
    // Load the other page to ensure Observe-Logs in clean status
    cy.clickNavLink(['Home', 'Search'])
    cy.clickNavLink(['Observe', 'Logs'])
  });

  after( function() {
    //cy.uiLogoutClusterAdminForUser("First");
  });

  it('selected namespaces',{tags:['@observ','level0','@logui-0002']}, () => {
    coreObsLogsTests.selectNamespaces();
  });

});
