/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { SecretValue, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { Bucket } from "aws-cdk-lib/aws-s3";

import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import {
  Mapping,
  OnDemandFlow,
  S3Destination,
  SalesforceConnectorProfile,
  SalesforceDataTransferApi,
  SalesforceSource,
  SalesforceConnectorType,
} from "../../src";

describe("SalesforceSource", () => {
  test("Source with only connector name", () => {
    const stack = new Stack(undefined, "TestStack");
    const source = new SalesforceSource({
      profile: SalesforceConnectorProfile.fromConnectionProfileName(
        stack,
        "TestProfile",
        "dummy-profile",
      ),
      dataTransferApi: SalesforceDataTransferApi.REST_SYNC,
      enableDynamicFieldUpdate: true,
      apiVersion: "1",
      includeDeletedRecords: true,
      object: "Account",
    });

    const expectedConnectorType = SalesforceConnectorType.instance;
    expect(source.connectorType.asProfileConnectorLabel).toEqual(
      expectedConnectorType.asProfileConnectorLabel,
    );
    expect(source.connectorType.asProfileConnectorType).toEqual(
      expectedConnectorType.asProfileConnectorType,
    );
    expect(source.connectorType.asTaskConnectorOperatorOrigin).toEqual(
      expectedConnectorType.asTaskConnectorOperatorOrigin,
    );
    expect(source.connectorType.isCustom).toEqual(
      expectedConnectorType.isCustom,
    );
  });

  test("Source in a Flow is in the stack", () => {
    const stack = new Stack(undefined, "TestStack");
    const source = new SalesforceSource({
      profile: SalesforceConnectorProfile.fromConnectionProfileName(
        stack,
        "TestProfile",
        "dummy-profile",
      ),
      dataTransferApi: SalesforceDataTransferApi.REST_SYNC,
      enableDynamicFieldUpdate: true,
      apiVersion: "1",
      includeDeletedRecords: true,
      object: "Account",
    });

    const destination = new S3Destination({
      location: { bucket: new Bucket(stack, "TestBucket") },
    });

    new OnDemandFlow(stack, "TestFlow", {
      source: source,
      destination: destination,
      mappings: [Mapping.mapAll()],
    });

    Template.fromStack(stack).hasResourceProperties("AWS::AppFlow::Flow", {
      DestinationFlowConfigList: [
        {
          ConnectorType: "S3",
          DestinationConnectorProperties: {
            S3: {
              BucketName: {
                Ref: "TestBucket560B80BC",
              },
            },
          },
        },
      ],
      FlowName: "TestStackTestFlow32CDAF42",
      SourceFlowConfig: {
        ApiVersion: "1",
        ConnectorProfileName: "dummy-profile",
        ConnectorType: "Salesforce",
        SourceConnectorProperties: {
          Salesforce: {
            DataTransferApi: "REST_SYNC",
            EnableDynamicFieldUpdate: true,
            IncludeDeletedRecords: true,
            Object: "Account",
          },
        },
      },
      Tasks: [
        {
          ConnectorOperator: {
            Salesforce: "NO_OP",
          },
          SourceFields: [],
          TaskProperties: [
            {
              Key: "EXCLUDE_SOURCE_FIELDS_LIST",
              Value: "[]",
            },
          ],
          TaskType: "Map_all",
        },
      ],
      TriggerConfig: {
        TriggerType: "OnDemand",
      },
    });
  });

  test("Source for dummy-profile in a Flow is in the stack", () => {
    const stack = new Stack(undefined, "TestStack");

    const secret = Secret.fromSecretNameV2(
      stack,
      "TestSecret",
      "appflow/salesforce/client",
    );
    const profile = new SalesforceConnectorProfile(stack, "TestProfile", {
      oAuth: {
        accessToken: SecretValue.unsafePlainText("accessToken"),
        flow: {
          refreshTokenGrant: {
            refreshToken: SecretValue.unsafePlainText("refreshToken"),
            client: secret,
          },
        },
      },
      instanceUrl: "https://instance-id.develop.my.salesforce.com",
    });

    const source = new SalesforceSource({
      profile: profile,
      dataTransferApi: SalesforceDataTransferApi.REST_SYNC,
      enableDynamicFieldUpdate: true,
      apiVersion: "1",
      includeDeletedRecords: true,
      object: "Account",
    });

    const destination = new S3Destination({
      location: { bucket: new Bucket(stack, "TestBucket") },
    });

    new OnDemandFlow(stack, "TestFlow", {
      source: source,
      destination: destination,
      mappings: [Mapping.mapAll()],
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::AppFlow::ConnectorProfile", {
      ConnectionMode: "Public",
      ConnectorProfileConfig: {
        ConnectorProfileCredentials: {
          Salesforce: {
            AccessToken: "accessToken",
            ClientCredentialsArn: {
              "Fn::Join": [
                "",
                [
                  "arn:",
                  {
                    Ref: "AWS::Partition",
                  },
                  ":secretsmanager:",
                  {
                    Ref: "AWS::Region",
                  },
                  ":",
                  {
                    Ref: "AWS::AccountId",
                  },
                  ":secret:appflow/salesforce/client",
                ],
              ],
            },
            RefreshToken: "refreshToken",
          },
        },
        ConnectorProfileProperties: {
          Salesforce: {
            InstanceUrl: "https://instance-id.develop.my.salesforce.com",
          },
        },
      },
      ConnectorProfileName: "TestStackTestProfile18724107",
      ConnectorType: "Salesforce",
    });

    template.hasResourceProperties("AWS::AppFlow::Flow", {
      DestinationFlowConfigList: [
        {
          ConnectorType: "S3",
          DestinationConnectorProperties: {
            S3: {
              BucketName: {
                Ref: "TestBucket560B80BC",
              },
            },
          },
        },
      ],
      FlowName: "TestStackTestFlow32CDAF42",
      SourceFlowConfig: {
        ApiVersion: "1",
        ConnectorProfileName: "TestStackTestProfile18724107",
        ConnectorType: "Salesforce",
        SourceConnectorProperties: {
          Salesforce: {
            DataTransferApi: "REST_SYNC",
            EnableDynamicFieldUpdate: true,
            IncludeDeletedRecords: true,
            Object: "Account",
          },
        },
      },
      Tasks: [
        {
          ConnectorOperator: {
            Salesforce: "NO_OP",
          },
          SourceFields: [],
          TaskProperties: [
            {
              Key: "EXCLUDE_SOURCE_FIELDS_LIST",
              Value: "[]",
            },
          ],
          TaskType: "Map_all",
        },
      ],
      TriggerConfig: {
        TriggerType: "OnDemand",
      },
    });
  });
});
