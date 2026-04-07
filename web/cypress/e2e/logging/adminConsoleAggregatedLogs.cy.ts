import { aggrLogsTests } from './testUtils.cy';
import { testData } from '../../fixtures/data-test';

describe('AdminConsole: Admin in AggregatedLogs', { tags: ['@admin'] }, () => {
  before( function() {
    cy.uiLoginAsClusterAdminForUser("first");
  });

  beforeEach( function() {
    cy.showAdminConsolePodAggrLog(testData.appNamespace1);
  });

  after( function() {
    cy.uiLogoutClusterAdminForUser("first");
  });

  it('validate elements in Aggregated Logs',{tags:['@aggr','@logui-1000']}, () => {
    aggrLogsTests.validateElements();
  });

  it('display applicatioins logs',{tags:['@common','@logui-1001']}, () => {
    cy.assertAppLogsInLogsTable();
  });

  it('select both running and deleted pods',{tags:['@aggr','@logui-1002']}, () => {
    aggrLogsTests.selectPods();
  });

  it('selected containers',{tags:['@aggr','@logui-1003']}, () => {
    aggrLogsTests.selectContainers();
  });

  it('Search by content',{tags:['@common','@logui-1004']}, () => {
    aggrLogsTests.searchContent();
  });

  it('filter logs by last duration ',{tags:['@common','@log-1005']}, () => {
    aggrLogsTests.filterByTimeDuration();
  });

  it('filter logs by custom range',{tags:['@common','@logui-1006']}, () => {
    aggrLogsTests.filterByTimeRange();
  });

  it('Show Resources',{tags:['@common','@logui-1007']}, () => {
    aggrLogsTests.showResources();
  });

  it('switch the dataFormat',{tags:['@common','@logui-1008']},function() {
    aggrLogsTests.switchDataSchema(this);
  });

  it('admin can display infra container logs',{tags:['@aggr','@level0','@logui-1010']}, () => {
    aggrLogsTests.validateInfraContainerLogFields()
  });
});

describe('AdminConsole: Impersonate User in AggregatedLogs',{ tags: ['@admin'] }, () => {
  before( function() {
    cy.grantLogViewRolesToUser("second", testData.appNamespace1);
    cy.grantLogViewRolesToUser("second", testData.appNamespace2);
    cy.cliLoginAsUser("second")
    cy.uiLoginAsClusterAdminForUser("first");
    cy.uiImpersonateUser("second");
    cy.switchToAdmConsole();
  });

  beforeEach( function() {
    cy.showAdminConsolePodAggrLog(testData.appNamespace1);
  });

  after( function() {
    cy.uiLogoutUser("second");
    cy.removeLogViewRolesFromUser("second", testData.appNamespace1);
    cy.removeLogViewRolesFromUser("second", testData.appNamespace2);
  });

  it('display applicatioins logs',{tags:['@common','@level0','@logui-1011']}, () => {
    cy.assertAppLogsInLogsTable();
  });

  it('select both running and deleted pods',{tags:['@aggr','@logui-1014']}, () => {
    aggrLogsTests.selectPods();
  });
});

describe('AdminConsole: User in Aggregated Logs', { tags: ['@user'] }, () => {
  before( function() {
    cy.grantLogViewRolesToUser("second", testData.appNamespace1);
    cy.grantLogViewRolesToUser("second", testData.appNamespace2);
    cy.uiLoginAsUser("second");
  });

  beforeEach( function() {
    cy.showAdminConsolePodAggrLog(testData.appNamespace1);
  });

  after( function() {
    cy.uiLogoutUser("second");
    cy.removeLogViewRolesFromUser("second", testData.appNamespace1);
    cy.removeLogViewRolesFromUser("second", testData.appNamespace2);
  });

  it('validate elements in Aggregated Logs',{tags:['@aggr','@level0','@logui-1022']}, () => {
    aggrLogsTests.validateElements();
  });

  it('display applicatioins logs',{tags:['@common','@level0','@logui-1021']}, () => {
    cy.assertAppLogsInLogsTable();
  });

  it('Show Resources',{tags:['@common','@level0','@logui-1023']}, () => {
    aggrLogsTests.showResources();
  });

  it('select both running and deleted pods',{tags:['@aggr', '@level0', '@logui-1024']}, () => {
    aggrLogsTests.selectPods();
  });

  it('selected containers',{tags:['@aggr','@level0','@logui-1025']}, () => {
    aggrLogsTests.selectContainers();
  });

  it('Search by content ',{tags:['@common','@level0','@logui-1026']}, () => {
    aggrLogsTests.searchContent();
  });

  it('filter logs by last duration ',{tags:['@common','level0','@log-1027']}, () => {
    aggrLogsTests.filterByTimeDuration();
  });
  
  it('filter logs by custom range',{tags:['@common','level0','@logui-1028']}, () => {
    aggrLogsTests.filterByTimeRange();
  });

  it('validate app container logs fileds',{tags:['@aggr','@level0','@logui-1010']}, () => {
    aggrLogsTests.validateAppContainerLogFields();
  });

});
