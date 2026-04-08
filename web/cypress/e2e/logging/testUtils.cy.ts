//Common logging UI Cases
//Note: the default namespace is testData.appNamespace1 for all test in this file
import { TestIds } from '../../../src/test-ids';
import { testData, Classes } from '../../fixtures/data-test';

export function isDevConsoleReady(): boolean {
  //Check if DevConsole is enabled in 4.19+
  const rawversion = Cypress.env('OPENSHIFT_VERSION');
  if (!rawversion) {
    throw new Error('OPENSHIFT_VERSION is not defined');
  }
  const version = String(rawversion)
  const [major, minor] = version.split('.').map(Number);
  if (major > 4 || (major === 4 && minor > 18)) {
    return cy.exec("oc get console.operator cluster -o jsonpath='{.spec.customization.perspectives}'", { failOnNonZeroExit: false })
      .then((result) => {
        const devReady = result.stdout === '[{"id":"dev","visibility":{"state":"Enabled"}}]';
        return devReady;
      });
  }
  return cy.wrap(true);
}

export function getRunningPodName(namespace: string, labelSelector?: string) {
  // Build the oc command
  let cmd = `oc get pods -n ${namespace} --field-selector=status.phase=Running -o jsonpath="{.items[0].metadata.name}"`
  if (labelSelector) {
    cmd += ` -l ${labelSelector}`
  }
  return cy.exec(cmd).then((res) => res.stdout.trim())
}

// Common test cases for Observe->Logs Logs
export class sharedTests {
  // Select Namespaces in Logging panel. 
  static selectNamespaces() {
    const namespaces=[testData.appNamespace1, testData.appNamespace2]
    cy.checkLogNamespaces(namespaces);
    cy.showLogQueryInput();
    cy.byTestID(TestIds.LogsQueryInput)
      .find('textarea')
      .invoke('val')
      .then((val) => {
        expect(val).to.include(testData.appNamespace1);
        expect(val).to.include(testData.appNamespace2);
      });

    const indexFields : Cypress.IndexField[] = [
      { name: 'openshift_log_type', value: "application" },
      { name: 'k8s_namespace_name', value: `${testData.appNamespace1}|${testData.appNamespace2}` },
    ];
    cy.assertFieldsInLogDetail(indexFields);
  }

  // Select Pods in console. Both deleted and running pods can be selected
  static selectPods() {
    getRunningPodName(testData.appNamespace1).as('pod1Name');
    cy.get('@pod1Name').then((podName) => {
       cy.exec(`oc -n ${testData.appNamespace1} delete pods ${podName} --wait=true`);
    });
    getRunningPodName(testData.appNamespace1).as('pod1NewName');
    cy.get('@pod1NewName').then((pod1NewName) => {
      cy.exec(`oc -n ${testData.appNamespace1} wait pods/${pod1NewName} --for=condition=Ready`);
    });
    getRunningPodName(testData.appNamespace2).as('pod2Name');

    cy.get('@pod1Name').then((pod1Name) => {
      cy.get('@pod1NewName').then((pod1NewName) => {
        cy.get('@pod2Name').then((pod2Name) => {
	  const pods: string[] = [pod1Name.trim(), pod1NewName.trim(), pod2Name.trim()];
          cy.checkLogPods(pods);
          //cy.task('log', `pod1Name=${pod1Name} pod1NewName=${pod1NewName}, pod2Name=${pod2Name} `);
          cy.showLogQueryInput();
          cy.byTestID(TestIds.LogsQueryInput)
            .find('textarea')
            .invoke('val')
            .then((val) => {
              //{ kubernetes_pod_name=~"centos-logtest-xx|centos-logtest-yyy|centos-logtest-zzz"
              expect(val).to.include(pod1Name);
              expect(val).to.include(pod1NewName);
              expect(val).to.include(pod2Name);
            });
          cy.byTestID(TestIds.ExecuteQueryButton).click();
          const indexFields : Cypress.IndexField[] = [
            { name: 'openshift_log_type', value: "application" },
            { name: 'k8s_namespace_name', value: `${testData.appNamespace1}|${testData.appNamespace2}` },
            { name: 'k8s_pod_name', value: `${pod1Name}|${pod1NewName}|${pod2Name}` },
          ]
          cy.assertFieldsInLogDetail(indexFields);
        });
      });
    });
  }


  // Select containers. same name container from all namesapcs present
  static selectContainers(){
    getRunningPodName(testData.appNamespace1).as('pod1Name');
    getRunningPodName(testData.appNamespace2).as('pod2Name');

    cy.get('@pod1Name').then((pod1Name) => {
      cy.get('@pod2Name').then((pod2Name) => {
        const containers = [testData.appContainerName];
        cy.checkLogContainers(containers);
        cy.showLogQueryInput();

        let pattern1 = new RegExp(`kubernetes_container_name="${testData.appContainerName}"`);
	let pattern2 = new RegExp(`kubernetes_pod_name.*${pod1Name}.*`);
	let pattern3 = new RegExp(`kubernetes_pod_name.*${pod2Name}.*`);
        if (String(Cypress.env('CLUSTERLOGGING_DATAMODE')) === "otel") {
          pattern1 = new RegExp(`k8s_container_name="${testData.appContainerName}"`);
	  pattern2 = new RegExp(`k8s_pod_name.*${pod1Name}.*`);
	  pattern3 = new RegExp(`k8s_pod_name.*${pod2Name}.*`);
        }
        cy.byTestID(TestIds.LogsQueryInput)
          .find('textarea')
          .invoke('val')
          .then((val) => {
            expect(val).to.match(pattern1);
            expect(val).to.match(pattern2);
            expect(val).to.match(pattern3);
	  });
      });
    });
  }

  // list logs which incldue content testData.appMessageKey
  static searchContent(){
    cy.selectLogAttribute('Content');
    cy.byTestID(TestIds.AttributeFilters).within(() => {
      cy.get('input[aria-label="Search by Content"]')
        .clear()
        .type(testData.appMessageKey, {delay: 0})
      });
    cy.showLogQueryInput();
    cy.byTestID(TestIds.LogsQueryInput,{timeout: 60000})
      .find('textarea', { timeout: 60000 })
      .should('include.value', testData.appMessageKey);
    cy.byTestID(TestIds.ExecuteQueryButton).click();
    cy.assertAppLogsInLogsTable();
  }

  // show the resource information of the log record
  static showResources() {
    cy.get('button').contains('Show Resources').click();
    getRunningPodName(testData.appNamespace1).then((pod1Name) => {
      const namespaces = [testData.appNamespace1]
      const pods = [pod1Name]
      //cy.checkLogNamespaces(namespaces);
      cy.checkLogPods(pods);
      cy.byTestID(TestIds.ExecuteQueryButton).click();
      cy.byTestID(TestIds.LogsTable).within(() => {
        cy.get('td[data-label="message"]')
        .first()
        .within(()=> {
          cy.get(`a[href="/k8s/cluster/namespaces/${testData.appNamespace1}"]`).should('exist');
          cy.get(`a[href="/k8s/ns/${testData.appNamespace1}/pods/${pod1Name}"]`).should('exist');
          cy.get(`a[href="/k8s/ns/${testData.appNamespace1}/pods/${pod1Name}/containers/${testData.appContainerName}"]`).should('exist')
        });
      });
    });
  }

  static filterByTimeDuration(){
    cy.byTestID(TestIds.TimeRangeDropdown).find('button').click();
    cy.byTestID(TestIds.TimeRangeDropdown).contains('Last 5 minutes').click();
    cy.url().should('match', /start=now-5m&end=now/);
    cy.byTestID(TestIds.ExecuteQueryButton).click();
    cy.assertLogsInLogsTable()

    cy.byTestID(TestIds.TimeRangeDropdown).find('button').click();
    cy.byTestID(TestIds.TimeRangeDropdown).contains('Last 2 hours').click();
    cy.url().should('match', /start=now-2h&end=now/);
    cy.byTestID(TestIds.ExecuteQueryButton).click();
    cy.assertLogsInLogsTable()

    cy.byTestID(TestIds.TimeRangeDropdown).find('button').click();
    cy.byTestID(TestIds.TimeRangeDropdown).contains('Last 1 day').click();
    cy.url().should('match', /start=now-1d&end=now/);
    cy.byTestID(TestIds.ExecuteQueryButton).click();
    cy.assertLogsInLogsTable()

    cy.byTestID(TestIds.TimeRangeDropdown).find('button').click();
    cy.byTestID(TestIds.TimeRangeDropdown).contains('Last 2 weeks').click();
    cy.url().should('match', /start=now-2w&end=now/);
    cy.byTestID(TestIds.ExecuteQueryButton).click();
    cy.assertLogsInLogsTable();
    // recover to 1 hour
    cy.byTestID(TestIds.TimeRangeDropdown).find('button').click();
    cy.byTestID(TestIds.TimeRangeDropdown).contains('Last 1 hour').click();
    cy.byTestID(TestIds.ExecuteQueryButton).click();
    cy.assertLogsInLogsTable();
  }

  static filterByTimeRange(){
    const pad = (num) => num.toString().padStart(2, '0');
    const now = new Date();
    // startDate = now-3day 
    const startDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
    const startDay = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`;
    // endDate = now-2day
    const endDate = new Date(now.getTime() - 2* 24 * 60 * 60 * 1000)
    // Format as 'YYYY-MM-DD'
    const endDay = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}`;
    // Format as 'hh:mm'
    const startTime = `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`;
    const endTime = `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`;

    cy.byTestID(TestIds.TimeRangeDropdown).find('button').click();
    cy.byTestID(TestIds.TimeRangeDropdown).contains('Custom time range').click();
    cy.byTestID(TestIds.TimeRangeSelectModal).within(() => {
      cy.get('input[aria-label="Date picker"]').first().clear().type(`${startDay}`).blur();
      cy.get('input[aria-label="Precision time picker"]').first().clear().type(`${startTime}{enter}`);

      cy.get('input[aria-label="Date picker"]').last().clear().type(`${endDay}`).blur();
      cy.get('input[aria-label="Precision time picker"]').last().clear().type(`${endTime}{enter}`);
    });
    cy.byTestID(TestIds.TimeRangeDropdownSaveButton).click();
    cy.byTestID(TestIds.TimeRangeDropdown)
      .within(() => {
        cy.contains(`${startDay} ${startTime} - ${endDay} ${endTime}`);
      });

    //Remove milleseconds as we won't provide it in console
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), startDate.getHours(), startDate.getMinutes())
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), endDate.getHours(), endDate.getMinutes())
    cy.url().should('match', new RegExp(`start=${start.getTime()}&end=${end.getTime()}`));
    // recover to 1 hour

    cy.byTestID(TestIds.TimeRangeDropdown).find('button').click();
    cy.byTestID(TestIds.TimeRangeDropdown).contains('Last 1 hour').click();
    cy.byTestID(TestIds.ExecuteQueryButton).click();
    cy.assertLogsInLogsTable();
  }

  // switch the dataSchema when dataMode is select
  static switchDataSchema(context: Mocha.Context) {
    if (String(Cypress.env('CLUSTERLOGGING_DATAMODE')) != "select" ) {
      context.skip();
    }

    //default viaq
    cy.byTestID(TestIds.SchemaToggle)
      .invoke('text')
      .should('eq', 'viaq');
    cy.showLogQueryInput();
    cy.byTestID(TestIds.LogsQueryInput)
      .find('textarea')
      .invoke('val')
      .should('include', '| json');
    cy.assertLogsInLogsTable();

    //switch to Otel
    cy.byTestID(TestIds.SchemaToggle).click({force: true});
    cy.get('li')
      .contains('button', 'otel')
      .click();
    cy.showLogQueryInput();
    cy.byTestID(TestIds.LogsQueryInput)
      .find('textarea')
      .invoke('val')
      .should('not.include', '| json');
    cy.byTestID(TestIds.ExecuteQueryButton).click();
    cy.assertLogsInLogsTable();

    //switch back to Viaq
    cy.byTestID(TestIds.SchemaToggle).click({force: true});
    cy.get('li')
      .contains('button', 'viaq')
      .click();
    cy.showLogQueryInput();
    cy.byTestID(TestIds.LogsQueryInput)
      .find('textarea')
      .invoke('val')
      .should('include', '| json');
    cy.byTestID(TestIds.ExecuteQueryButton).click();
    cy.assertLogsInLogsTable();
  }

  // show the application logs
  static selectApplicationLog(){
    cy.selectLogTenant('application')
    let query = '{ log_type="application" } | json'
    if (String(Cypress.env('CLUSTERLOGGING_DATAMODE')) === "otel") {
      query = '{ openshift_log_type="application" }'
    }
    cy.showLogQueryInput();
    cy.byTestID(TestIds.LogsQueryInput)
      .find('textarea')
      .invoke('val')
      .should('eq', query)
    cy.assertAppLogsInLogsTable();
  }

  // show infrastructure logs
  static selectInfraLog(){
    cy.selectLogTenant('infrastructure')
    let query = '{ log_type="infrastructure" } | json'
    if (String(Cypress.env('CLUSTERLOGGING_DATAMODE')) === "otel") {
      query = '{ openshift_log_type="infrastructure" }'
    }
    cy.showLogQueryInput();
    cy.byTestID(TestIds.LogsQueryInput)
      .find('textarea')
      .invoke('val')
      .should('eq', query)
    cy.assertInfraLogsInLogsTable();
  }

  // show audit logs
  static selectAuditLog(){
    cy.selectLogTenant('audit')
    let query = '{ log_type="audit" } | json'
    if (String(Cypress.env('CLUSTERLOGGING_DATAMODE')) === "otel") {
      query = '{ openshift_log_type="audit" }'
    }
    cy.showLogQueryInput();
    cy.byTestID(TestIds.LogsQueryInput)
      .find('textarea')
      .invoke('val')
      .should('eq', query)
    cy.assertAuditLogsInLogsTable();
  }

  // validate the common fields present. 
  static validateAppContainerLogFields() {
    // Note: only representative field are checked, not all fileds
    // value="" means value will not be checked
    const indexViaqFields : Cypress.IndexField[] = [
      { name: '_timestamp', value: testData.isoTimestampRegex },
      { name: 'hostname', value: testData.hostnameRegex },
      { name: 'kubernetes_container_image', value: "" },
      { name: 'kubernetes_labels_test',value: testData.appContainerName },
      { name: 'kubernetes_labels_run',value: testData.appContainerName },
      { name: 'kubernetes_pod_owner', value: "" },
      { name: 'kubernetes_container_id', value: testData.uuidRegex },
      { name: 'kubernetes_pod_ip', value: "" },
      { name: 'kubernetes_pod_id', value: testData.uuidRegex },
      { name: 'kubernetes_container_iostream', value: /\w+/ },
      { name: 'kubernetes_namespace_id',value: testData.uuidRegex },
      { name: 'message', value: "" },
      { name: 'openshift_sequence', value: /\d+/ },
    ];
    const indexCommonFields : Cypress.IndexField[] = [
      { name: 'k8s_container_name', value: testData.dnsRegex },
      { name: 'k8s_namespace_name', value: testData.dnsRegex },
      { name: 'k8s_node_name', value: testData.dnsRegex },
      { name: 'k8s_pod_name', value: testData.dnsRegex },
      { name: 'kubernetes_container_name',value: testData.dnsRegex },
      { name: 'kubernetes_namespace_name', value: testData.dnsRegex },
      { name: 'kubernetes_host', value: testData.hostnameRegex },
      { name: 'kubernetes_pod_name', value: testData.hostnameRegex },
      { name: 'level', value: /\w+/ },
      { name: 'log_type', value: "application" },
      { name: 'log_source', value: "container" },
      { name: 'openshift_cluster_id', value: testData.uuidRegex },
      { name: 'openshift_log_type', value: "application" },
    ];
    const indexOtelFields : Cypress.IndexField[] = [
      { name: 'observed_timestamp', value: /\d{19}/ },
      { name: 'severity_text', value: /\w+/ },
      { name: 'openshift_cluster_uid', value: testData.uuidRegex },
      { name: 'openshift_log_source', value: "container" },
      { name: 'k8s_pod_label_test',value: testData.appContainerName },
      { name: 'k8s_pod_label_run',value: testData.appContainerName },
    ];
    const timestampPattern = /^[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{2}:\d{2}:\d{2}\.\d{3}$/;
    let mergedFields = [...indexViaqFields,...indexCommonFields];
    if (String(Cypress.env('CLUSTERLOGGING_DATAMODE')) == "otel" ) {
      mergedFields = [...indexOtelFields,...indexCommonFields];
    }

    let query = '{{}log_type="application",kubernetes_namespace_name="log-test-app1"{}}|json'
    if (String(Cypress.env('CLUSTERLOGGING_DATAMODE')) === "otel") {
      query = '{{} openshift_log_type="application",k8s_namespace_name="log-test-app1" {}}'
    }
    cy.runLogQuery(query);

    cy.byTestID(TestIds.LogsTable)
      .should('exist')
      .within(() => {
        cy.get('td[data-label="date"]')
          .first()
          .invoke('text')
          .should('match', timestampPattern);
        cy.get('td[data-label="message"]')
          .first()
          .invoke('text')
          .should('match', testData.appMessageRegex);
      });
    cy.assertFieldsInLogDetail(mergedFields);
  }

  // validate the common fields present. 
  static validateContainerLogFields(){
    // Note: only representative field are checked, not all fileds
    // Viaq Only Fields
    const indexViaqFields : Cypress.IndexField[] = [
      { name: '_timestamp', value: testData.isoTimestampRegex },
      { name: 'hostname', value: testData.hostnameRegex },
      { name: 'kubernetes_container_image', value: "" },
      { name: 'kubernetes_pod_owner', value: "" },
      { name: 'kubernetes_container_id', value: testData.uuidRegex },
      { name: 'kubernetes_pod_ip', value: "" },
      { name: 'kubernetes_pod_id', value: testData.uuidRegex },
      { name: 'kubernetes_container_iostream', value: /\w+/ },
      { name: 'kubernetes_namespace_id',value: testData.uuidRegex },
      { name: 'message', value: "" },
      { name: 'openshift_sequence', value: /\d+/ },
    ];
    //common index Fields for both viaq and Otel
    const indexCommonFields : Cypress.IndexField[] = [
      { name: 'k8s_container_name', value: testData.dnsRegex },
      { name: 'k8s_namespace_name', value: testData.dnsRegex },
      { name: 'k8s_node_name', value: testData.dnsRegex },
      { name: 'k8s_pod_name', value: testData.dnsRegex },
      { name: 'kubernetes_host', value: testData.hostnameRegex },
      { name: 'log_type', value: "infrastructure" },
      { name: 'log_source', value: "container" },
      { name: 'openshift_log_type', value: "infrastructure" },
      { name: 'openshift_cluster_id', value: testData.uuidRegex },
    ];
    // Otel only Fields
    const indexOtelFields : Cypress.IndexField[] = [
      { name: 'severity_text', value: /\w+/ },
      { name: 'observed_timestamp', value: /\d{19}/ },
      { name: 'openshift_cluster_uid', value: testData.uuidRegex },
      { name: 'openshift_log_source', value: "container" },
    ];
    let mergedFields = [...indexViaqFields,...indexCommonFields];
    if (String(Cypress.env('CLUSTERLOGGING_DATAMODE')) === "otel") {
      mergedFields = [...indexOtelFields,...indexCommonFields];
    }
    cy.assertFieldsInLogDetail(mergedFields);
  }

  // validate the common fields present. 
  static validateInfraContainerLogFields(){
    cy.selectLogTenant('infrastructure')
    let query = '{{}log_type="infrastructure"{}}|json|log_source="container"'
    if (String(Cypress.env('CLUSTERLOGGING_DATAMODE')) === "otel") {
      query = '{{} openshift_log_type="infrastructure",openshift_log_source="container" {}}'
    }
    cy.runLogQuery(query);
    sharedTests.validateContainerLogFields();
  }

  // validate the common fields present. 
  static validateInfraNodeLogFields(){
    cy.selectLogTenant('infrastructure')
    let query = '{{}log_type="infrastructure"{}}|json|log_source="node"'
    if (String(Cypress.env('CLUSTERLOGGING_DATAMODE')) === "otel") {
      query = '{{} log_type="infrastructure",log_source="node" {}}'
    }
    cy.runLogQuery(query)

    // Note: only representative field are checked, not all fileds
    const systemIDRegex = /^[0-9a-f]{32}$/
    //Viaq IndexFields
    const indexViaqFields : Cypress.IndexField[] = [
      { name: '_timestamp', value: testData.isoTimestampRegex },
      { name: 'hostname', value: testData.hostnameRegex },
      { name: 'message', value: "" },
      { name: 'openshift_sequence', value: /\d+/ },
      { name: 'systemd_t_BOOT_ID', value: systemIDRegex},
      { name: 'systemd_t_COMM', value: "" },
      { name: 'systemd_t_EXE', value: "" },
      { name: 'systemd_t_PID', value: /\d+/ },
      { name: 'systemd_t_SYSTEMD_UNIT', value: "" },
      { name: 'systemd_t_TRANSPORT', value: /\w+/ },
      { name: 'systemd_t_UID', value: /\d+/ },
      { name: 'systemd_u_SYSLOG_FACILITY', value: /\d+/ },
    ];
    //Common IndexFields
    const indexCommonFields : Cypress.IndexField[] = [
      { name: 'k8s_node_name', value: testData.dnsRegex },
      { name: 'kubernetes_host', value: testData.dnsRegex },
      { name: 'level', value: /\w+/ },
      { name: 'log_type', value: "infrastructure" },
      { name: 'log_source', value: "node" },
      { name: 'openshift_log_type', value: "infrastructure" },
      { name: 'openshift_cluster_id', value: testData.uuidRegex },
    ];
    // Otel only Fields
    const indexOtelFields : Cypress.IndexField[] = [
      { name: 'severity_text', value: /\w+/ },
      { name: 'observed_timestamp', value: /\d{19}/ },
      { name: 'openshift_cluster_uid', value: testData.uuidRegex },
      { name: 'process_command_line', value: "" },
      { name: 'process_executable_name', value: "" },
      { name: 'process_executable_path', value: "" },
      { name: 'process_pid', value: /\d+/ },
      { name: 'openshift_log_source', value: "node" },
    ];
    let mergedFields = [...indexViaqFields,...indexCommonFields];
    if (String(Cypress.env('CLUSTERLOGGING_DATAMODE')) === "otel") {
      mergedFields = [...indexOtelFields,...indexCommonFields];
    }
    cy.assertFieldsInLogDetail(mergedFields);
  }

  // validate the common fields present.
  static validateKubeAPILogFields(){
    let query = '{{} log_type="audit" {}} | json | log_source =~ "kubeAPI|openshiftAPI"'
    if (String(Cypress.env('CLUSTERLOGGING_DATAMODE')) === "otel") {
      query = '{{} openshift_log_type="audit", openshift_log_source =~ "kubeAPI|openshiftAPI"{}}'
    }
    //Viaq IndexFields
    const indexViaqFields : Cypress.IndexField[] = [
      { name: '_timestamp', value: testData.isoTimestampRegex },
      { name: 'apiVersion', value: "audit.k8s.io/v1" },
      { name: 'auditID', value: testData.uuidRegex },
      { name: 'hostname', value: testData.hostnameRegex },
      { name: 'kind', value: /\w+/ },
      { name: 'level', value: /\w+/ },
      { name: 'k8s_audit_level', value: /\w+/ },
      { name: 'requestReceivedTimestamp', value: "" },
      { name: 'requestURI', value: "" },
      { name: 'stage', value: /\w+/ },
      { name: 'stageTimestamp', value: /\w+/ },
      { name: 'user_username', value: /\w+/ },
      { name: 'verb', value: /\w+/ },
      { name: 'openshift_sequence', value: /\d+/ },
    ];
    //Common IndexFields
    const indexCommonFields : Cypress.IndexField[] = [
      { name: 'k8s_node_name', value: testData.dnsRegex },
      { name: 'kubernetes_host', value: testData.dnsRegex },
      { name: 'log_type', value: "audit" },
      { name: 'log_source', value: /\w+/ },
      { name: 'openshift_log_type', value: "audit" },
      { name: 'openshift_cluster_id', value: testData.uuidRegex },
    ];
    //Otel IndexFields
    const indexOtelFields : Cypress.IndexField[] = [
      { name: 'observed_timestamp', value: /\d{19}/ },
      { name: 'openshift_log_source', value: /\w+/ },
      { name: 'openshift_cluster_uid', value: testData.uuidRegex },
    ];
    let mergedFields = [...indexViaqFields,...indexCommonFields];

    cy.selectLogTenant('audit');
    cy.runLogQuery(query);

    if (String(Cypress.env('CLUSTERLOGGING_DATAMODE')) === "otel") {
      mergedFields = [...indexOtelFields,...indexCommonFields];
    }
    cy.assertFieldsInLogDetail(mergedFields);
  }
 
  // validate the common fields present.
  static validateLinuxLogFields(){
    let query = '{{}log_type="audit"{}}|json|log_source="auditd"'
    if (String(Cypress.env('CLUSTERLOGGING_DATAMODE')) === "otel") {
      query = '{{}openshift_log_type="audit",openshift_log_source="auditd"{}}'
    }

    cy.selectLogTenant('audit');
    cy.runLogQuery(query);

    //Viaq IndexFields
    const indexViaqFields : Cypress.IndexField[] = [
      { name: '_timestamp', value: testData.isoTimestampRegex },
      { name: 'audit_linux_record_id', value: /\w+/ },
      { name: 'audit_linux_type', value: /\w+/ },
      { name: 'level', value: /\w+/ },
      { name: 'message', value: ""},
      { name: 'openshift_sequence', value: /\d+/ },
    ];
    //Common IndexFields
    const indexCommonFields : Cypress.IndexField[] = [
      { name: 'k8s_node_name', value: testData.dnsRegex },
      { name: 'kubernetes_host', value: testData.dnsRegex },
      { name: 'log_type', value: "audit" },
      { name: 'log_source', value: "auditd"},
      { name: 'openshift_log_type', value: "audit" },
      { name: 'openshift_cluster_id', value: testData.uuidRegex },
    ];
    //Otel IndexFields
    const indexOtelFields : Cypress.IndexField[] = [
      { name: 'observed_timestamp', value: /\d{19}/ },
      { name: 'openshift_log_source', value: "auditd" },
      { name: 'openshift_cluster_uid', value: testData.uuidRegex },
    ];

    let mergedFields = [...indexViaqFields,...indexCommonFields];
    if (String(Cypress.env('CLUSTERLOGGING_DATAMODE')) === "otel") {
      mergedFields = [...indexOtelFields,...indexCommonFields];
    }
    cy.assertFieldsInLogDetail(mergedFields);
  }
}

export class coreObsLogsTests extends sharedTests {
  // validate all elements presents.
  static validateElements(){
    const commonElements = [
      TestIds.ToggleHistogramButton,
      TestIds.TimeRangeDropdown,
      TestIds.RefreshIntervalDropdown,
      TestIds.SyncButton,
      TestIds.AvailableAttributes,
      TestIds.SeverityDropdown,
      TestIds.ShowStatsToggle,
      TestIds.ExecuteVolumeButton,
      TestIds.ExecuteQueryButton,
      TestIds.ShowQueryToggle,
      TestIds.LogsTable,
    ];
    commonElements.forEach(id => {
      cy.byTestID(id).should('exist');
    });

    cy.byTestID(TestIds.AvailableAttributes).click();
    cy.get(Classes.MenuItem).contains('Content').should('exist');
    cy.get(Classes.MenuItem).contains('Pod').should('exist');
    cy.get(Classes.MenuItem).contains('Containers').should('exist');
    cy.get(Classes.MenuItem).contains('Namespaces').should('exist');

    const severityItems = ["critical","error","warning","debug","info","trace","unknown"]
    cy.byTestID(TestIds.SeverityDropdown).click();
    severityItems.forEach(item => {
      cy.get(Classes.MenuItem).contains(item).should('exist');
    });

    cy.byTestID(TestIds.TenantToggle).should('exist');
    cy.byTestID(TestIds.TenantToggle).click();
    cy.get(Classes.MenuItem).contains('application').should('exist');
    cy.get(Classes.MenuItem).contains('infrastructure').should('exist');
    cy.get(Classes.MenuItem).contains('audit').should('exist');

    if (Cypress.env('CLUSTERLOGGING_DATAMODE') === "select" ) {
      cy.byTestID(TestIds.SchemaToggle).should('exist');
    }
    if (Cypress.env('LOGGING_UI_TIMEZONE') === "true" ) {
      cy.byLegacyTestID(TestIds.TimezoneDropdown).should('exist');
    }
  }
}

// shared test cases for DevConsole&AdminConsole -> Observe->logs
export class devObsLogsTests extends sharedTests{
  // validate all elements presents
  static validateElements(){
    const commonElements = [
      TestIds.ToggleHistogramButton,
      TestIds.TimeRangeDropdown,
      TestIds.RefreshIntervalDropdown,
      TestIds.SyncButton,
      TestIds.AvailableAttributes,
      TestIds.SeverityDropdown,
      TestIds.ShowStatsToggle,
      TestIds.ExecuteVolumeButton,
      TestIds.ExecuteQueryButton,
      TestIds.ShowQueryToggle,
      TestIds.LogsTable,
    ];
    commonElements.forEach(id => {
      cy.byTestID(id).should('exist');
    });

    cy.byTestID(TestIds.AvailableAttributes).click();
    cy.get(Classes.MenuItem).contains('Content').should('exist')
    cy.get(Classes.MenuItem).contains('Pod').should('exist')
    cy.get(Classes.MenuItem).contains('Containers').should('exist')
    cy.get(Classes.MenuItem).contains('Namespaces').should('exist')

    const severityItems = ["critical","error","warning","debug","info","trace","unknown"]
    cy.byTestID(TestIds.SeverityDropdown).click();
    severityItems.forEach(item => {
      cy.get(Classes.MenuItem).contains(item).should('exist');
    });

    cy.byTestID(TestIds.TenantToggle).should('not.exist');

    if (Cypress.env('CLUSTERLOGGING_DATAMODE') === "select" ) {
      cy.byTestID(TestIds.SchemaToggle).should('exist');
    }
    if (Cypress.env('LOGGING_UI_TIMEZONE') === "true" ) {
      cy.byLegacyTestID(TestIds.TimezoneDropdown).should('exist');
    }
  }

    //list containers we want to show. note: only container from current namespace can be selected
  static selectContainers(){
    const containers = [testData.appContainerName]
    cy.checkLogContainers(containers);

    cy.showLogQueryInput();
    let pattern1 = new RegExp(`{.*kubernetes_container_name="${testData.appContainerName}".*} | json`);
    let pattern2 = new RegExp(`{.*kubernetes_namespace_name="${testData.appNamespace1}".*} | json`);
    if (String(Cypress.env('CLUSTERLOGGING_DATAMODE')) === "otel") {
      pattern1 = new RegExp(`{.*k8s_container_name="${testData.appContainerName}".*}`);
      pattern2 = new RegExp(`{.*k8s_namespace_name="${testData.appNamespace1}".*}`);
    }
    cy.byTestID(TestIds.LogsQueryInput)
      .find('textarea')
      .invoke('val')
      .then((val) => {
          expect(val).to.match(pattern1)
          expect(val).to.match(pattern2)
      });
    cy.byTestID(TestIds.ExecuteQueryButton).click();
    const indexFields : IndexField = [
      { name: 'k8s_namespace_name', value: testData.appNamespace1 },
      { name: 'k8s_container_name', value: testData.appContainerName },
    ];
    cy.assertFieldsInLogDetail(indexFields);
  }

  // show the application logs
  static selectApplicationLog(){
    let  query = `{ kubernetes_namespace_name="${testData.appNamespace1}" } | json`
    if (String(Cypress.env('CLUSTERLOGGING_DATAMODE')) === "otel") {
      query = `{ k8s_namespace_name="${testData.appNamespace1}" }`
    }
    cy.showLogQueryInput();
    cy.byTestID(TestIds.LogsQueryInput)
      .find('textarea')
      .invoke('val')
      .should('eq', query)
    cy.assertAppLogsInLogsTable();
  }
}

// shared test cases for DevConsole&AdminConsole -> Pod Detail ->Aggregation Logs 
export class aggrLogsTests extends sharedTests {
  // validate all elements presents
  static validateElements(){
    const commonElements = [
      TestIds.ToggleHistogramButton,
      TestIds.TimeRangeDropdown,
      TestIds.RefreshIntervalDropdown,
      TestIds.SyncButton,
      TestIds.AvailableAttributes,
      TestIds.SeverityDropdown,
      TestIds.ShowStatsToggle,
      TestIds.ExecuteVolumeButton,
      TestIds.ExecuteQueryButton,
      TestIds.ShowQueryToggle,
      TestIds.LogsTable,
    ];
    commonElements.forEach(id => {
      cy.byTestID(id).should('exist');
    });

    cy.byTestID(TestIds.AvailableAttributes).click();
    cy.get(Classes.MenuDiv).should('exist')
    cy.get(Classes.MenuItem).contains('Content').should('exist')
    cy.get(Classes.MenuItem).contains('Pod').should('exist')
    cy.get(Classes.MenuItem).contains('Containers').should('exist')
    cy.get(Classes.MenuItem).contains('Namespaces').should('not.exist')
    
    const severityItems = ["critical","error","warning","debug","info","trace","unknown"]
    cy.byTestID(TestIds.SeverityDropdown).click();
    severityItems.forEach(item => {
      cy.get(Classes.MenuItem).contains(item).should('exist');
    });

    cy.byTestID(TestIds.TenantToggle).should('not.exist'); 

    if (Cypress.env('CLUSTERLOGGING_DATAMODE') === "select" ) {
      cy.byTestID(TestIds.SchemaToggle).should('exist');
    }
    if (Cypress.env('LOGGING_UI_TIMEZONE') === "true" ) {
      cy.byLegacyTestID(TestIds.TimezoneDropdown).should('exist');
    }

  }

  //list pods we want to show. note: both deleted and running pods can be selected. Only pods from current namespace can be selected
  static selectPods() {
    getRunningPodName(testData.appNamespace1).as('pod1Name');
    cy.get('@pod1Name').then((podName) => {
       cy.exec(`oc -n ${testData.appNamespace1} delete pods ${podName} --wait=true`);
    });
    getRunningPodName(testData.appNamespace1).as('pod1NewName');
    cy.get('@pod1NewName').then((pod1NewName) => {
      cy.exec(`oc -n ${testData.appNamespace1} wait pods/${pod1NewName} --for=condition=Ready`);
    });

    cy.get('@pod1Name').then((pod1Name) => {
      cy.get('@pod1NewName').then((pod1NewName) => {
        const pods: string[] = [pod1Name.trim(), pod1NewName.trim()];
        cy.checkLogPods(pods);
        cy.showLogQueryInput();
        cy.byTestID(TestIds.LogsQueryInput)
          .find('textarea')
          .invoke('val')
          .then((val) => {
            //{ kubernetes_pod_name=~"centos-logtest-xx|centos-logtest-yyy" 
            expect(val).to.include(pod1Name)
            expect(val).to.include(pod1NewName)
          });
        cy.byTestID(TestIds.ExecuteQueryButton).click();
        const indexFields : Cypress.IndexField[] = [
          { name: 'openshift_log_type', value: "application" },
          { name: 'k8s_namespace_name', value: testData.appNamespace1 },
          { name: 'k8s_pod_name', value: `${pod1Name}|${pod1NewName}` },
        ]
        cy.assertFieldsInLogDetail(indexFields);
      });
    });
  }


  //list containers we want to show. note: only container from current namespace can be selected
  static selectContainers(){
    const containers = [testData.appContainerName]
    cy.checkLogContainers(containers);

    cy.showLogQueryInput();
    let pattern1 = new RegExp(`{.*kubernetes_container_name="${testData.appContainerName}".*} | json`);
    let pattern2 = new RegExp(`{.*kubernetes_pod_name="${testData.appContainerName}-\\w+".*} | json`);
    if (String(Cypress.env('CLUSTERLOGGING_DATAMODE')) === "otel") {
      pattern1 = new RegExp(`{.*k8s_container_name="${testData.appContainerName}".*}`);
      pattern2 = new RegExp(`{.*k8s_pod_name="${testData.appContainerName}-\\w+".*}`);
    }
    cy.byTestID(TestIds.LogsQueryInput)
      .find('textarea')
      .invoke('val')
      .then((val) => {
          expect(val).to.match(pattern1)
          expect(val).to.match(pattern2)
      });
    cy.byTestID(TestIds.ExecuteQueryButton).click();
    const indexFields : IndexField = [
      { name: 'k8s_namespace_name', value: testData.appNamespace1 },
      { name: 'k8s_container_name', value: testData.appContainerName },
    ];
    cy.assertFieldsInLogDetail(indexFields);
  }

  //list containers we want to show. note: only container from current namespace can be selected
  static showResources(){
    cy.get('button').contains('Show Resources').click();
    getRunningPodName(testData.appNamespace1).then((pod1Name) => {
      const pods = [pod1Name]
      cy.checkLogPods(pods);
      cy.byTestID(TestIds.ExecuteQueryButton).click();
      cy.byTestID(TestIds.LogsTable).within(() => {
        cy.get('td[data-label="message"]')
        .first()
        .within(()=> {
          cy.get(`a[href="/k8s/cluster/namespaces/${testData.appNamespace1}"]`).should('exist');
          cy.get(`a[href="/k8s/ns/${testData.appNamespace1}/pods/${pod1Name}"]`).should('exist');
          cy.get(`a[href="/k8s/ns/${testData.appNamespace1}/pods/${pod1Name}/containers/${testData.appContainerName}"]`).should('exist')
        });
      });
    });
  }

  // show the application logs
  static selectApplicationLog(){
    let query = '{ log_type="application" } | json'
    if (String(Cypress.env('CLUSTERLOGGING_DATAMODE')) === "otel") {
      query = '{ openshift_log_type="application" }'
    }
    cy.showLogQueryInput();
    cy.byTestID(TestIds.LogsQueryInput)
      .find('textarea')
      .invoke('val')
      .should('eq', query)
    cy.assertAppLogsInLogsTable();
  }
  
  //Infra Container logs can be show when user can view infra namespace
  static validateInfraContainerLogFields(){
    cy.showAdminConsolePodAggrLog('openshift-monitoring','alertmanager-main-0');
    sharedTests.validateContainerLogFields();
  }
}

// test cases for DevConsole -> Pod Detail ->Aggregation Logs
export class devAggrLogsTests extends aggrLogsTests {
  // show the application logs
  static selectApplicationLog(){
    let query = /{ kubernetes_pod_name = "[\w-]+" } | json $/
    if (String(Cypress.env('CLUSTERLOGGING_DATAMODE')) === "otel") {
      query = /{ k8s_pod_name = "[\w-]+" }$/
    }
    cy.showLogQueryInput();
    cy.wait(100)
    cy.byTestID(TestIds.LogsQueryInput)
      .find('textarea')
      .invoke('val')
      .then((val) => {
        expect(val).to.match(query);
      })
    cy.assertAppLogsInLogsTable();
  }
}
