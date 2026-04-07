#!/usr/bin/env bash
set +x
# Author: anli@redhat.com
#
# Description: 
# Run Logging UI test using the given users. test cases can be executed using Environment  CYPRESS_SPEC or CYPRESS_TAG
#
# Prerequisite: 
# The Environment KUBECONFIG must be exported.
# clusterlogging are deployed
# coo is deployed and loggingUI plugin are enabled
# appplication, infrastructure and audit logs are sent to lokistack constantly
# pod logs in namespaces log-test-app1,log-test-app2 are sent to lokisack constantly
# (Note: In prow, step openshift-observability-enable-cluster-logging can prepare test data)
# An avaiable IDP and at least two users. you can set IDP using Environments CYPRESS_LOGIN_IDP,CYPRESS_LOGIN_USERS. the func enable_idp_htpasswd will create IDP if absent 
# (Note: In prow, step openshift-observability-enable-cluster-logging can prepare test data)
#
#

## Add htpasswd IDP and Users
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UI_USERS=""

function enable_idp_htpasswd()
{
    echo "## Create htpasswd IDP users"
    htpass_file="/tmp/uihtpasswd"
    uiusers_file="/tmp/uihtpusers"

    idp_list=$(oc get oauth cluster -o jsonpath='{.spec.identityProviders}')
    if [[ $idp_list =~ "uiauto-htpasswd-idp" ]];then
        # using existing idp if the user can login
        echo "The idp uiauto-htpasswd-idp had been created"
        if [[ -f $uiusers_file ]];then
            echo "Verify if user can login uiauto-htpasswd-idp"
            UI_USERS=$(cat $uiusers_file)
            echo "get users from ${uiusers_file}"
            first_record=${UI_USERS%%,*}
            first_passwd=${first_record##*:}
            cp $KUBECONFIG /tmp/normal_kubeconfig || exit 1
            oc login  --username=uiauto-test-1 --password=${first_passwd} --kubeconfig=/tmp/normal_kubeconfig >/dev/null  2>&1
            if [[ $? == 0 ]];then
                echo "Login the idp succesed, the users are in $uiusers_file"
                echo "Enable IDP uiauto-htpasswd-idp succesfully"
                return 0
            else
                echo "Can not login the idp, please remove uiauto-htpasswd-idp from oauth/cluster and re-run this script"
                exit 1
            fi
        else
            echo "Can not find users, please remove uiauto-htpasswd-idp from oauth/cluster and re-run this script"
            exit 1
        fi 
    fi

    echo "Create new users and add uiauto-htpasswd-idpuiauto-htpasswd-idp"
    #Create users with random password and save users
    for i in $(seq 1 5); do
        username="uiauto-test-${i}"
        password=$(tr </dev/urandom -dc 'a-z0-9' | fold -w 12 | head -n 1 || true)
        UI_USERS+="${username}:${password},"
        if [ -f "${htpass_file}" ]; then
            htpasswd -B -b ${htpass_file} "${username}" "${password}"
        else
            htpasswd -c -B -b ${htpass_file} "${username}" "${password}"
        fi
    done
    # remove trailing ',' for case parsing
    UI_USERS=${UI_USERS%?}
    echo $UI_USERS >$uiusers_file
    echo "Users are store in ${UI_USERS}"

    # record current generation number
    gen_number=$(oc -n openshift-authentication get deployment oauth-openshift -o jsonpath='{.metadata.generation}')

    # add users to cluster
    oc -n openshift-config create secret generic uiauto-htpass-secret  || true
    oc -n openshift-config set data secret/uiauto-htpass-secret --from-file=htpasswd=${htpass_file} -n openshift-config || exit 1

    idp_list=$(oc get oauth cluster -o jsonpath='{.spec.identityProviders}')
    if [[ $idp_list == ""  || $idp_list == "{}" ]];then
        oc patch oauth cluster --type='json' -p='[{"op": "add", "path": "/spec/identityProviders", "value": [{"type": "HTPasswd", "name": "uiauto-htpasswd-idp", "mappingMethod": "claim", "htpasswd":{"fileData":{"name": "uiauto-htpass-secret"}}}]}]' || exit 1
    else
        oc patch oauth cluster --type='json' -p='[{"op": "add", "path": "/spec/identityProviders/-", "value": {"type": "HTPasswd", "name": "uiauto-htpasswd-idp", "mappingMethod": "claim", "htpasswd":{"fileData":{"name": "uiauto-htpass-secret"}}}}]' || exit 1
    fi

    echo "Wait up to 5 minutes for new idp take effect"
    expected_replicas=$(oc -n openshift-authentication get deployment oauth-openshift -o jsonpath='{.spec.replicas}')
    count=1
    while [[ $count -le 6 ]]; do
        echo "try the ${count} time "
        available_replicas=$(oc -n openshift-authentication get deployment oauth-openshift -o jsonpath='{.status.availableReplicas}')
        new_gen_number=$(oc get -n openshift-authentication deployment oauth-openshift -o jsonpath='{.metadata.generation}')
        if [[ $expected_replicas == "$available_replicas" && $((new_gen_number)) -gt $((gen_number)) ]]; then
            break
        else
            sleep 30s
        fi
        (( count=count+1 ))
    done

    echo "Verify if uiauto-htpasswd-idp works"
    echo "Login as the new user"
    cp $KUBECONFIG /tmp/normal_kubeconfig || exit 1
    first_record=${UI_USERS%%,*}
    first_passwd=${first_record##*:}

    echo "oc login -u uiauto-test-1 -p <first_user_passwd> --config=/tmp/normal_kubeconfig"
    oc login  --username=uiauto-test-1 --password=${first_passwd} --kubeconfig=/tmp/normal_kubeconfig >/dev/null 2>&1 || exit 1
    echo "Enable IDP uiauto-htpasswd-idp succesfully"
}

function check_clusterlogging(){
    echo "## Verify test data are ready for Logging UI Test"

    echo "Check if the clusterlogging are are ready"
    lokistack_name=$(oc get lokistack -n openshift-logging -o jsonpath={.items[0].metadata.name})
    if [[ $lokistack_name == "" ]]; then
        echo "No lokistack can be found in openshift-logging namespace"
        exit 1
    fi

    echo "Check if the dataMode is correct"
    if [[ "$data_mode" == "otel" ]]; then
	log_minor_version=${CYPRESS_CLUSTERLOGGING_VERSION#*.}
	#Check the enableConsoleLabels in Logging 6.5+
	if [[ "log_minor_version" -ge 5 ]];then
            otlp_labels=$(oc -n openshift-logging get lokistack "${lokistack_name}" -o jsonpath='{.spec.tenants.openshift.otlp.enableConsoleLabels}' 2>/dev/null)
	    otlp_labels=$(echo "$otlp_labels" | tr -d '[:space:]')
            if [[ "$otlp_labels" != "true" ]]; then
                echo "Error: tenants.openshift.otlp.enableConsoleLabels in lokistack must be true when schema is otel logging uiplugin"
                exit 1
            fi
	fi	
	clf_labels=$(oc -n openshift-logging get obsclf -o jsonpath='{.items[].spec.outputs[].lokiStack.dataModel}' 2>/dev/null)
	clf_labels=$(echo "$clf_labels" | tr -d '[:space:]')
	if [[ "$clf_labels" != *"Otel"* ]]; then
            echo "Error: the dataMode must be Otel in obsclf, it is ${clf_labels} now"
            exit 1
	fi
    fi

    echo "Warning, lokistack ${lokistack_name} is selected, please confirm if that is the one you are using in openshift-logging"
    oc -n openshift-logging wait pod --for=condition=ready -l  app.kubernetes.io/instance=${lokistack_name} || exit 1
    oc -n openshift-logging wait pod --for=condition=ready -l  app.kubernetes.io/component=collector || exit 1


    echo "Check if there are running test pods in log-test-app1 and log-test-app2"
    oc -n log-test-app1 wait pod --for=condition=ready -l test=centos-logtest || exit 1
    oc -n log-test-app2 wait pod --for=condition=ready -l test=centos-logtest || exit 1

    echo "Check if logs can be found in lokistack"
    lokistack_route=$(oc -n openshift-logging get route ${lokistack_name} -n openshift-logging -o json |jq '.spec.host' -r)
    oc -n openshift-logging create sa lokistack-query >/dev/null 2>&1
    oc -n openshift-logging adm policy add-cluster-role-to-user cluster-admin -z lokistack-query
    oc -n openshift-logging adm policy add-cluster-role-to-user cluster-logging-application-view -z lokistack-query
    oc -n openshift-logging adm policy add-cluster-role-to-user cluster-logging-audit-view -z lokistack-query
    oc -n openshift-logging adm policy add-cluster-role-to-user cluster-logging-infrastructure-view -z lokistack-query

    bearer_token=$(oc -n openshift-logging create token lokistack-query)

    echo "Verify infrastructure logs in lokistack"
    rm /tmp/loki_query.txt
    curl -s -G -k -H "Authorization: Bearer ${bearer_token}" https://${lokistack_route}/api/logs/v1/infrastructure/loki/api/v1/query_range --data-urlencode 'query={log_type="infrastructure"}' --data-urlencode 'limit=1' -o /tmp/loki_query.txt
    if [[ $(cat /tmp/loki_query.txt |jq '.data.result|length') == 1  ]]; then
       echo "Found infrastructure logs"
    else
       echo "Exit, can not find infrastructure logs"
       cat /tmp/loki_query.txt
       exit 1
    fi

    echo "Verify application logs in lokistack"
    rm /tmp/loki_query.txt
    curl -s -G -k -H "Authorization: Bearer ${bearer_token}" https://${lokistack_route}/api/logs/v1/application/loki/api/v1/query_range --data-urlencode 'query={log_type="application"}' --data-urlencode 'limit=1'  -o /tmp/loki_query.txt
    if [[ $(cat /tmp/loki_query.txt |jq '.data.result|length') == 1  ]]; then
       echo "Found application logs"
    else
       echo "Exit, can not find application logs"
       cat /tmp/loki_query.txt
    fi

    echo "Verify audit logs in lokistack"
    rm /tmp/loki_query.txt
    curl -s -G -k -H "Authorization: Bearer ${bearer_token}" https://${lokistack_route}/api/logs/v1/audit/loki/api/v1/query_range --data-urlencode 'query={log_type="audit"}' --data-urlencode 'limit=1'  -o /tmp/loki_query.txt
    if [[ $(cat /tmp/loki_query.txt |jq '.data.result|length') == 1  ]]; then
       echo "Found audit logs"
    else
       echo "Exit, can not find audit logs"
       cat /tmp/loki_query.txt
       exit 1
    fi
}

########Main###################
if [[ $KUBECONFIG == "" ]]; then
   echo "Exit, you must expose the Environment KUBECONFIG"
   exit 1
fi

export CYPRESS_BASE_URL="https://$(oc get route console -n openshift-console  -o jsonpath={.spec.host})"
export CYPRESS_OPENSHIFT_VERSION=$(oc version -o json  |jq -r '.openshiftVersion'|cut -f 1,2 -d.)

csv_name=$(oc -n openshift-logging get csv -l "operators.coreos.com/cluster-logging.openshift-logging" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
if [[ -z "$csv_name" ]]; then
    echo "Error: Could not find the cluster-logging CSV."
    exit 1
fi
full_version=$(oc -n openshift-logging get csv "$csv_name" -o jsonpath='{.spec.version}')
export CYPRESS_CLUSTERLOGGING_VERSION=$(echo "$full_version" | cut -d. -f1,2)

csv_name=$(oc get csv -l olm.copiedFrom"="openshift-cluster-observability-operator -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
full_version=$(oc get csv "$csv_name" -o jsonpath='{.spec.version}')
export CYPRESS_COO_VERSION=$(echo "$full_version" | cut -d. -f1,2)

data_mode=$(oc get uiplugin logging -o jsonpath='{.spec.logging.schema}')
if [[ "$data_mode" == "" ]];then
    data_mode="viaq"
fi
export CYPRESS_CLUSTERLOGGING_DATAMODE=${data_mode}

timezone=$(oc get uiplugin logging -o jsonpath='{.spec.logging.showTimezoneSelector}')
if [[ "$timezone" == "" ]];then
    timezone="false"
fi
export CYPRESS_LOGGING_UI_TIMEZONE=${timezone}

check_clusterlogging

if [[ "$CYPRESS_LOGIN_IDP" == "" || "$CYPRESS_LOGIN_USERS" == "" ]];then
   enable_idp_htpasswd
   export CYPRESS_LOGIN_IDP=uiauto-htpasswd-idp
   export CYPRESS_LOGIN_USERS=$UI_USERS
fi
if [[ $CYPRESS_LOGIN_USERS == "" ]];then
   echo "Please set correct Env CYPRESS_LOGIN_USERS  and CYPRESS_LOGIN_IDP or leave these two Env unset"
   exit 1
fi

echo "## Environment"
echo "export KUBECONFIG=${KUBECONFIG}"
echo "export CYPRESS_BASE_URL=$CYPRESS_BASE_URL"
echo "export CYPRESS_LOGIN_IDP=$CYPRESS_LOGIN_IDP"
echo "export CYPRESS_LOGIN_USERS=xxxxxxxx"
echo "export CYPRESS_OPENSHIFT_VERSION=$CYPRESS_OPENSHIFT_VERSION"
echo "export CYPRESS_CLUSTERLOGGING_VERSION=$CYPRESS_CLUSTERLOGGING_VERSION"
echo "export CYPRESS_CLUSTERLOGGING_DATAMODE=$CYPRESS_CLUSTERLOGGING_DATAMODE"
echo "export CYPRESS_LOGGING_UI_TIMEZONE=$CYPRESS_LOGGING_UI_TIMEZONE"
echo "export CYPRESS_COO_VERSION=${CYPRESS_COO_VERSION}"

echo "## Execute Cypress cases"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd $script_dir/../

cypress_args=""
if [[ "$CYPRESS_SPEC" == "" ]];then
    CYPRESS_SPEC="$(ls cypress/e2e/logging/*.ts|paste -sd ',' -)"
fi

if [[ "$CYPRESS_TAG" != "" ]]; then
    set -x
    npx cypress run --e2e --spec "${CYPRESS_SPEC}" --env '{"grepTags":"'${CYPRESS_TAG// /}'","grepFilterSpecs":true}'
else
    set -x
    npx cypress run --e2e --spec "${CYPRESS_SPEC}"
fi
set +x
