import { TestIds } from '../../../src/test-ids';
import { testData } from '../../fixtures/data-test';
import { isDevConsoleReady, devObsLogsTests } from './testUtils.cy';

let SKIPALL= false

describe('DevConsole: Admin in ObserveLogs', { tags: ['@admin'] }, () => {
  before( function() {
    //Check if DevConsole is ready
    isDevConsoleReady().then((ready) => {
      if (!ready) {
        SKIPALL= true
        cy.task('log','DeveloperConsole is not ready — skipping suite');
        this.skip()
      }
    });
    cy.uiLoginAsClusterAdminForUser("first");
    cy.switchToDevConsole();
  });

  beforeEach( function() {
    // reload observe->logs for current pod in testData.appNamespace1
    cy.clickNavLink(['Observe'])
    cy.changeNamespace(testData.appNamespace1)
    cy.byLegacyTestID('horizontal-link-Logs').click();
    cy.assertLogsInLogsTable();
  });

  after( function() {
    if (!SKIPALL) {
      cy.uiLogoutClusterAdminForUser("first");
    }
  });

  it('validate elements in dev observeLogs',{tags:['@devobserv','@logui-3001']}, () => {
    devObsLogsTests.validateElements();
  });

  it('selected containers',{tags:['@devobserv','@logui-3002']}, () => {
    devObsLogsTests.selectContainers();
  });

  it('display applicatioins logs',{tags:['@common','@logui-3003']}, () => {
    devObsLogsTests.selectApplicationLog();
  });

  it('Show Resources',{tags:['@common','@logui-3004']}, () => {
    devObsLogsTests.showResources();
  });

  it('selected namespaces',{tags:['@observ','@logui-3005']}, () => {
    devObsLogsTests.selectNamespaces();
  });

  it('select both running and deleted pods',{tags:['@observ','@logui-3006']}, () => {
    devObsLogsTests.selectPods();
  });

  it('Search by content ',{tags:['@common','@level0','@logui-3007']}, () => {
    devObsLogsTests.searchContent();
  });

  it('filter logs by last duration ',{tags:['@common','level0','@log-3008']}, () => {
    devObsLogsTests.filterByTimeDuration();
  });

  it('filter logs by custom range',{tags:['@common','level0','@logui-3009']}, () => {
   devObsLogsTests.filterByTimeRange();
  });

  it('switch the dataFormat',{tags:['@common','@logui-3010']},function() {
    devObsLogsTests.switchDataSchema(this);
  });

  it('validate log format for application container',{tags:['@common','@logui-3011']}, () => {
    devObsLogsTests.validateAppContainerLogFields();
  });

  it('admin can display infra logs',{tags:['@devobserv','@level0', '@logui-3012']}, () => {
    // reload observe->logs
    cy.changeNamespace('openshift-monitoring');

    let query = '{ kubernetes_namespace_name="openshift-monitoring" } | json'
    if (String(Cypress.env('CLUSTERLOGGING_DATAMODE')) === "otel") {
      query = '{ k8s_namespace_name="openshift-monitoring" }'
    }
    cy.showLogQueryInput();
    cy.byTestID(TestIds.LogsQueryInput)
      .find('textarea')
      .invoke('val')
      .should('eq', query)
    cy.assertInfraLogsInLogsTable();
  });

  it('admin can not query without namespace',{tags:['@smoke','@devobserv', '@logui-3013']}, () => {
    let queryText = `{{}log_type="infrastructure" {}}`
    cy.showLogQueryInput();
    cy.byTestID(TestIds.LogsQueryInput)
      .find('textarea')
      .clear()
      .type(queryText, { delay: 0 });
    cy.byTestID(TestIds.ExecuteQueryButton).should('be.disabled');
    cy.byTestID(TestIds.LogsQueryInput)
      .should('contain.text', 'Please select a namespace');
  });
});

describe('DevConsole: Impersonate User in ObserveLogs',{ tags: ['@devobserv','@logui-3014'] },  () => {
  before( function() {
    //Check if DevConsole is ready
    isDevConsoleReady().then((ready) => {
      if (!ready) {
        SKIPALL= true
        cy.task('log','DeveloperConsole is not ready — skipping suite');
        this.skip()
      }
    });
    cy.cliLoginAsUser("second");
    cy.grantLogViewRolesToUser("second", testData.appNamespace1);
    cy.grantLogViewRolesToUser("second", testData.appNamespace2);
    cy.uiLoginAsClusterAdminForUser("first");
    cy.uiImpersonateUser("second");
    cy.switchToDevConsole();
  });

  beforeEach( function() {
    // reload observe->logs for current pod in testData.appNamespace1
    cy.clickNavLink(['Observe'])
    cy.changeNamespace(testData.appNamespace1)
    cy.byLegacyTestID('horizontal-link-Logs').click();
  }); 

  after( function() {
    if (!SKIPALL) {
      cy.uiLogoutUser("second");
      cy.removeLogViewRolesFromUser("second", testData.appNamespace1);
      cy.removeLogViewRolesFromUser("second", testData.appNamespace2);
    }
  });

  it('validate elements in dev observeLogs',{tags:['@devobserv','@level0','@logui-3015']}, () => {
    devObsLogsTests.validateElements();
  });

  it('display applicatioins logs',{tags:['@common','@level0','@logui-3018']}, () => {
    devObsLogsTests.selectApplicationLog();
  });

  it('user can not display infra logs',{tags:['@devobserv','@logui-3017']}, () => {
    let query='{{}  kubernetes_namespace_name="openshift-monitoring" {}}'
    if (String(Cypress.env('CLUSTERLOGGING_DATAMODE')) === "otel") {
        query='{{} k8s_namespace_name="openshift-monitoring" {}}'
    }
    cy.runLogQuery(query);
    cy.byTestID(TestIds.LogsTable).then(($alert) => {
        const fullText = $alert.text();
        expect(fullText).to.include('Warning alert:');
        expect(fullText).to.include('No datapoints found');
    });
  });

});

describe('DevConsole: User in ObserveLogs', { tags: ['@user'] }, () => {
  before( function() {
    //Check if DevConsole is ready
    isDevConsoleReady().then((ready) => {
      if (!ready) {
        SKIPALL= true
        cy.task('log','DeveloperConsole is not ready — skipping suite');
        this.skip()
      }
    });

    cy.grantLogViewRolesToUser("second", testData.appNamespace1);
    cy.grantLogViewRolesToUser("second", testData.appNamespace2);
    cy.uiLoginAsUser("second");
    cy.switchToDevConsole();
  });

  beforeEach( function() {
    cy.clickNavLink(['Observe'])
    cy.changeNamespace(testData.appNamespace1)
    cy.byLegacyTestID('horizontal-link-Logs').click();
  }); 

  after( function() {
    if (!SKIPALL) {
      cy.uiLogoutUser("second");
      cy.removeLogViewRolesFromUser("second", testData.appNamespace1);
      cy.removeLogViewRolesFromUser("second", testData.appNamespace2);
    }
  });

  it('validate elements in dev observeLogs',{tags:['@devobserv','@level0','@logui-3027']}, () => {
    devObsLogsTests.validateElements();
  });

  it('selected containers',{tags:['@devobserv','@level0','@logui-3028']}, () => {
    devObsLogsTests.selectContainers();
  });


  it('user can not display infra logs',{tags:['@devobserv','@logui-3017']}, () => {
    let query='{{}  kubernetes_namespace_name="openshift-monitoring" {}}'
    if (String(Cypress.env('CLUSTERLOGGING_DATAMODE')) === "otel") {
        query='{{} k8s_namespace_name="openshift-monitoring" {}}'
    }

    cy.runLogQuery(query);
    cy.get('.lv-plugin__table__row-error').then(($alert) => {
        const fullText = $alert.text();
        expect(fullText).to.include('Forbidden');
        expect(fullText).to.include('Missing permissions to get logs in this namespace');
        expect(fullText).to.include('You do not have permissions to view logs in the selected namespace.');
        expect(fullText).to.include('apiVersion: rbac.authorization.k8s.io');
        expect(fullText).to.include('kind: RoleBinding');
        expect(fullText).to.include('name: view-application-logs');
        expect(fullText).to.include('"name: cluster-logging-application-view');
    });
  });

  it('display applicatioins logs',{tags:['@common','@level0','@logui-3029']}, () => {
    devObsLogsTests.selectApplicationLog();
  });

  it('Show Resources',{tags:['@common','@logui-3030']}, () => {
    devObsLogsTests.showResources();
  });
  it('selected namespaces',{tags:['@observ','level0','@logui-3031']}, () => {
    devObsLogsTests.selectNamespaces();
  });
  it('select both running and deleted pods',{tags:['@observ','@logui-3032']}, () => {
    devObsLogsTests.selectPods();
  });

  it('Search by content ',{tags:['@common','@level0','@logui-3033']}, () => {
    devObsLogsTests.searchContent();
  });

  it('filter logs by last duration ',{tags:['@common','level0','@log-0034']}, () => {
    devObsLogsTests.filterByTimeDuration();
  });

  it('filter logs by custom range',{tags:['@common','level0','@logui-3035']}, () => {
    devObsLogsTests.filterByTimeRange();
  });
});
