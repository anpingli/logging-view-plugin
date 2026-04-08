import { TestIds } from '../../../src/test-ids';
import { testData } from '../../fixtures/data-test';
import { isDevConsoleReady, devAggrLogsTests } from './testUtils.cy';

let SKIPALL= false

describe('DevConsole: Admin in AggregatedLogs ', { tags: ['@admin'] }, () => {
  before( function() {
    //Check if DevConsole is ready
    isDevConsoleReady().then((ready) => {
      if (!ready) {
        SKIPALL= true
        cy.task('log','DeveloperConsole is not ready — skipping suite');
        this.skip()
      }
    });
    cy.uiLoginAsClusterAdminForUser("First");
    cy.switchToDevConsole();
  });

  beforeEach( function() {
    cy.showDevConsolePodAggrLog(testData.appNamespace1)
  });

  after( function() {
    if (!SKIPALL) {
      cy.uiLogoutClusterAdminForUser("First");
    }
  });

  it('display applicatioins logs',{tags:['@common','@logui-4001']}, () => {
    devAggrLogsTests.selectApplicationLog();
  });

  it('validate elements in Aggregated Logs',{tags:['@aggr','@level0','@logui-4002']}, () => {
    devAggrLogsTests.validateElements();
  });

  it('admin can display infra container logs', {tags: ['@aggr', '@logui-4003'] }, () => {
   //load Aggregated Logs for pod in openshift-monitoring
    cy.showDevConsolePodAggrLog('openshift-monitoring');
    cy.assertInfraLogsInLogsTable();
  });
});

describe('DevConsole: Impersonate User in AggregatedLogs', { tags: ['@admin'] },() => {
  before( function() {
    //Check if DevConsole is ready
    isDevConsoleReady().then((ready) => {
      if (!ready) {
        SKIPALL= true
        cy.task('log','DeveloperConsole is not ready — skipping suite');
        this.skip()
      }
    });
    cy.cliLoginAsUser("Second");
    cy.grantLogViewRolesToUser("Second", testData.appNamespace1);
    cy.grantLogViewRolesToUser("Second", testData.appNamespace2);
    cy.uiLoginAsClusterAdminForUser("First");
    cy.uiImpersonateUser("Second");
    cy.switchToDevConsole();
  });

  beforeEach( function() {
    cy.showDevConsolePodAggrLog(testData.appNamespace1);
  });

  after( function() {
    if (!SKIPALL) {
      cy.uiLogoutUser("Second");
      cy.removeLogViewRolesFromUser("Second", testData.appNamespace1);
      cy.removeLogViewRolesFromUser("Second", testData.appNamespace2);
    }
  });

  // skip for bug  https://github.com/openshift/logging-view-plugin/pull/317
  it.skip('user can not display infra logs',{tags:['@aggr','@logui-4004']}, () => {
    cy.runLogQuery('{{} k8s_namespace_name="openshift-monitoring" {}}');
    cy.byTestID(TestIds.LogsTable).within(() => {
       cy.get('.lv-plugin__table__row-error').should('exist');
       // It may  report error below
       //-' DateMessageDanger alert:{"error":"400 Bad Request","errorType":"observatorium-api","status":"error"}\n'
       //+'Warning alert:No datapoints found'
    });
  });

  it('display applicatioins logs',{tags:['@common','@logui-4005']}, () => {
    devAggrLogsTests.selectApplicationLog();
  });
});

describe('DevConsole: User in AggregatedLogs', { tags: ['@admin'] }, () => {
  before( function() {
    //Check if DevConsole is ready
    //Check if DevConsole is ready
    isDevConsoleReady().then((ready) => {
      if (!ready) {
        SKIPALL= true
        cy.task('log','DeveloperConsole is not ready — skipping suite');
        this.skip()
      }
    });
    cy.grantLogViewRolesToUser("Second", testData.appNamespace1);
    cy.grantLogViewRolesToUser("Second", testData.appNamespace2);
    cy.uiLoginAsUser("Second");
    cy.switchToDevConsole();
  });

  beforeEach( function() {
    //hover on project page
    cy.showDevConsolePodAggrLog(testData.appNamespace1);
  });

  after( function() {
    if (!SKIPALL) {
      cy.uiLogoutUser("Second");
      cy.removeLogViewRolesFromUser("Second", testData.appNamespace1);
      cy.removeLogViewRolesFromUser("Second", testData.appNamespace2);
    }
  });

  it('validate elements in Aggregated Logs',{tags:['@aggr','@level0','@logui-4006']}, () => {
    devAggrLogsTests.validateElements();
  });

  it('display applicatioins logs',{tags:['@common','@logui-4007']}, () => {
    devAggrLogsTests.selectApplicationLog();
  });

  it('Show Resources',{tags:['@common','@logui-4008']}, () => {
    devAggrLogsTests.showResources();
  });

  it('select both running and deleted pods',{tags:['@aggr','@logui-4009']}, () => {
    devAggrLogsTests.selectPods();
  });

  it('selected containers',{tags:['@aggr','@level0','@logui-4010']}, () => {
    devAggrLogsTests.selectContainers();
  });

  it('Search by content ',{tags:['@common','@level0','@logui-4011']}, () => {
    devAggrLogsTests.searchContent();
  });

  it('filter logs by last duration ',{tags:['@common','level0','@log-4012']}, () => {
    devAggrLogsTests.filterByTimeDuration();
  });

  it('filter logs by custom range',{tags:['@common','level0','@logui-4013']}, () => {
    devAggrLogsTests.filterByTimeRange();
  });

  it('switch the dataFormat',{tags:['@common','@logui-4014']},function() {
    devAggrLogsTests.switchDataSchema(this);
  });

  it('validate log format for application container',{tags:['@common','@logui-4015']}, () => {
    devAggrLogsTests.validateAppContainerLogFields();
  });

});
