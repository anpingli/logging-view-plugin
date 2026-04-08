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
    cy.uiLogoutClusterAdminForUser("First");
  });

  it('validate elements in core Observe Logs',{tags:['@observ','@level0','@logui-0001']}, () => {
    coreObsLogsTests.validateElements()
  });

  it('selected namespaces',{tags:['@observ','level0','@logui-0002']}, () => {
    coreObsLogsTests.selectNamespaces();
  });

  it('selected containers',{tags:['@observ','level0','@logui-0003']}, () => {
    coreObsLogsTests.selectContainers()
  });

  it('display applicatioins logs',{tags:['@common','@level0','@logui-0004']}, () => {
    cy.selectLogTenant('application')
    cy.assertAppLogsInLogsTable();
  });

  it('select both running and deleted pods',{tags:['@observ','@logui-0005']}, () => {
    coreObsLogsTests.selectPods();
  });

  it('Search by content ',{tags:['@common','@level0','@logui-0006']}, () => {
    coreObsLogsTests.searchContent();
  });

  it('Show Resources',{tags:['@common','level0','@logui-0007']}, () => {
    coreObsLogsTests.showResources();
  });

  it('filter logs by last duration ',{tags:['@common','level0','@log-0008']}, () => {
    coreObsLogsTests.filterByTimeDuration();
  });
  
  it('filter logs by custom range',{tags:['@common','level0','@logui-0009']}, () => {
    coreObsLogsTests.filterByTimeRange();
  });

  it('switch the dataFormat',{tags:['@common','@logui-0010']},function() {
    coreObsLogsTests.switchDataSchema(this);
  });
  
  it('validate log format for application container',{tags:['@common','@logui-0011']}, () => {
    coreObsLogsTests.validateAppContainerLogFields();
  });

  it('display infra logs',{tags:['@observ','@level0','@logui-0012']}, () => {
     coreObsLogsTests.selectInfraLog();
  });

  it('admin validate log format for infra container logs',{tags:['@observ','@logui-0013']}, () => {
     coreObsLogsTests.validateInfraContainerLogFields();
  });

  it('admin validate log format for infra node logs',{tags:['@observ','@logui-0014']}, () => {
     coreObsLogsTests.validateInfraNodeLogFields();
  });

  it('admin validate the log format for kubeAPIand Openshift API',{tags:['@observ','@logui-0015']}, () => {
     coreObsLogsTests.validateKubeAPILogFields();
  });

  it('admin validate the log format for auditd',{tags:['@observ','@logui-0016']}, () => {
     coreObsLogsTests.validateLinuxLogFields();
  });
});

describe.skip('AdminConsole: Impersonate User in ObserveLogs', { tags: ['@admin'] }, () => {
  before( function() {
    cy.cliLoginAsUser("Second");
    cy.grantLogViewRolesToUser("Second", testData.appNamespace1);
    cy.grantLogViewRolesToUser("Second", testData.appNamespace2);
    cy.uiLoginAsClusterAdminForUser("First");
    cy.switchToAdmConsole();
    cy.uiImpersonateUser("Second");
    cy.switchToAdmConsole();
  });

  beforeEach( function() {
    // Load the other page to ensure Observe-Logs in clean status
    cy.clickNavLink(['Home', 'Search'])
    cy.clickNavLink(['Observe', 'Logs'])
  });

  after( function() {
    cy.uiLogoutUser("Second");
    cy.removeLogViewRolesFromUser("Second", testData.appNamespace1);
    cy.removeLogViewRolesFromUser("Second", testData.appNamespace2);
  });
  
  it('display Logs are forbidedn by default',{tags:['@common','@level0','@logui-0017']}, () => {
    cy.selectLogTenant('application')
    cy.assertAppLogsInLogsTable();
  });

  it('display Logs are forbidedn by default',{tags:['@common','@level0','@logui-0018']}, () => {
    cy.selectLogTenant('application')
    cy.assertAppLogsInLogsTable();
  });

  it('user can not display audit logs',{tags:['@observ','@logui-0019']}, () => {
    cy.byTestID(TestIds.TenantToggle)
      .click()
      .get('#logging-view-tenant-dropdown')
      .contains('button', 'audit')
      .click()
    cy.byTestID(TestIds.LogsTable)
      .should('exist')
      .within(() => {
        cy.get('div.lv-plugin__table__row-error', { timeout: 600  })
	  .should('contain', 'Forbidden');
      });
  });

  it('selected namespaces',{tags:['@observ','@logui-0020']}, () => {
    coreObsLogsTests.selectNamespaces();
  });

})

describe('AdminConsole: User in ObserveLogs', { tags: ['@user'] }, () => {
  before( function() {
    cy.grantLogViewRolesToUser("Second", testData.appNamespace1)
    cy.grantLogViewRolesToUser("Second", testData.appNamespace2)
    cy.uiLoginAsUser("Second");
    cy.switchToAdmConsole();
  });

  beforeEach( function() {
    // Load the other page to ensure Observe-Logs in clean status
    cy.clickNavLink(['Home', 'Search'])
    cy.clickNavLink(['Observe', 'Logs'])
  });

  after( function() {
    cy.uiLogoutUser("Second");
    cy.removeLogViewRolesFromUser("Second", testData.appNamespace1);
    cy.removeLogViewRolesFromUser("Second", testData.appNamespace2);
  });

  it('validate elements in core Observe Logs',{tags:['@observ','@level0','@logui-0021']}, () => {
    coreObsLogsTests.validateElements();
  });

  it('display Logs are forbiden by default',{tags:['@common','@level0','@logui-0022']}, () => {
    cy.get('.lv-plugin__table__row-error').then(($alert) => {
        const fullText = $alert.text();
        expect(fullText).to.include('Forbidden');
        expect(fullText).to.include('Missing permissions to get logs');
        expect(fullText).to.include('Try selecting a specific namespace');
        expect(fullText).to.include('you may have access to view logs in specific namespaces but not cluster-wide');
        expect(fullText).to.include('If you still see this error after selecting a namespace, ask your administrator to grant you the required role');
        expect(fullText).to.include('apiVersion: rbac.authorization.k8s.io');
        expect(fullText).to.include('kind: RoleBinding');
        expect(fullText).to.include('name: view-application-logs');
        expect(fullText).to.include('name: cluster-logging-application-view');
        let query = '{ kubernetes_namespace_name = "<namespace>"}'
        if (String(Cypress.env('CLUSTERLOGGING_DATAMODE')) === "otel") {
            query = '{ k8s_namespace_name = "<namespace>"}'
	}
        expect(fullText).to.include(query);
    });
  });

  it('selected namespaces',{tags:['@observ','@logui-0023']}, () => {
    coreObsLogsTests.selectNamespaces();
  });

  it('display applicatioins logs',{tags:['@common','@level0','@logui-0024']}, () => {
    cy.selectLogTenant('application');
    const namespaces=[testData.appNamespace1]
    cy.checkLogNamespaces(namespaces);
    cy.assertAppLogsInLogsTable();
  });

  it('selected containers',{tags:['@observ','@level0','@logui-0025']}, () => {
    const namespaces=[testData.appNamespace1]
    cy.checkLogNamespaces(namespaces);
    coreObsLogsTests.selectContainers();
  });

  it('Show Resources',{tags:['@common','@logui-0026']}, () => {
    const namespaces=[testData.appNamespace1]
    cy.checkLogNamespaces(namespaces);
    coreObsLogsTests.showResources();
  });

  it('selected namespaces',{tags:['@observ','level0','@logui-0027']}, () => {
    coreObsLogsTests.selectNamespaces();
  });

  it('Search by content ',{tags:['@common','@level0','@logui-0028']}, () => {
    const namespaces=[testData.appNamespace1]
    cy.checkLogNamespaces(namespaces);
    coreObsLogsTests.searchContent();
  });

  it('filter logs by last duration ',{tags:['@common','@log-0029']}, () => {
    const namespaces=[testData.appNamespace1]
    cy.checkLogNamespaces(namespaces);
    coreObsLogsTests.filterByTimeDuration();
  });
  
  it('filter logs by custom range',{tags:['@common','@logui-0030']}, () => {
    const namespaces=[testData.appNamespace1]
    cy.checkLogNamespaces(namespaces);
    coreObsLogsTests.filterByTimeRange();
  });

});
