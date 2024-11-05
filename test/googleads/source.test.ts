/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { SecretValue, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { Bucket } from "aws-cdk-lib/aws-s3";

import {
  Mapping,
  GoogleAdsApiVersion,
  GoogleAdsConnectorProfile,
  GoogleAdsConnectorType,
  GoogleAdsSource,
  OnDemandFlow,
  S3Destination,
} from "../../src";

describe("GoogleAdsSource", () => {
  test("Source with only connector name", () => {
    const stack = new Stack(undefined, "TestStack");
    const source = new GoogleAdsSource({
      profile: GoogleAdsConnectorProfile.fromConnectionProfileName(
        stack,
        "TestProfile",
        "dummy-profile",
      ),
      object: "campaign-1112931111",
      apiVersion: GoogleAdsApiVersion.V16,
    });

    const expectedConnectorType = GoogleAdsConnectorType.instance;
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

  //   profile: GoogleAdsConnectorProfile;
  //     readonly apiVersion: string;
  //     readonly object: string;
  test("Source in a Flow is in the stack", () => {
    const stack = new Stack(undefined, "TestStack");
    const source = new GoogleAdsSource({
      profile: GoogleAdsConnectorProfile.fromConnectionProfileName(
        stack,
        "TestProfile",
        "dummy-profile",
      ),
      apiVersion: GoogleAdsApiVersion.V16,
      object: "campaign",
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
        ApiVersion: "v16",
        ConnectorProfileName: "dummy-profile",
        ConnectorType: "CustomConnector",
        SourceConnectorProperties: {
          CustomConnector: {
            EntityName: "campaign",
          },
        },
      },
      Tasks: [
        {
          ConnectorOperator: {
            CustomConnector: "NO_OP",
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

    const profile = new GoogleAdsConnectorProfile(stack, "TestProfile", {
      oAuth: {
        accessToken: SecretValue.unsafePlainText("accessToken"),
        flow: {
          refreshTokenGrant: {
            refreshToken: SecretValue.unsafePlainText("refreshToken"),
            clientId: SecretValue.unsafePlainText("clientId"),
            clientSecret: SecretValue.unsafePlainText("clientSecret"),
          },
        },
      },
      apiVersion: GoogleAdsApiVersion.V16,
      managerID: SecretValue.unsafePlainText("managerId"),
      developerToken: SecretValue.unsafePlainText("developerToken"),
    });

    const source = new GoogleAdsSource({
      profile: profile,
      object: "campaign-1112931111",
      apiVersion: GoogleAdsApiVersion.V16,
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
      ConnectorProfileName: "TestStackTestProfile18724107",
      ConnectorType: "CustomConnector",
      ConnectorLabel: "GoogleAds",
      ConnectorProfileConfig: {
        ConnectorProfileCredentials: {
          CustomConnector: {
            AuthenticationType: "OAUTH2",
            Oauth2: {
              AccessToken: "accessToken",
              ClientId: "clientId",
              ClientSecret: "clientSecret",
              RefreshToken: "refreshToken",
            },
          },
        },
        ConnectorProfileProperties: {
          CustomConnector: {
            OAuth2Properties: {
              OAuth2GrantType: "AUTHORIZATION_CODE",
              TokenUrl: "https://oauth2.googleapis.com/token",
            },
          },
        },
      },
    });

    template.hasResource("AWS::AppFlow::Flow", {
      Properties: {
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
          ApiVersion: "v16",
          ConnectorProfileName: "TestStackTestProfile18724107",
          ConnectorType: "CustomConnector",
          SourceConnectorProperties: {
            CustomConnector: {
              EntityName: "campaign-1112931111",
            },
          },
        },
        Tasks: [
          {
            ConnectorOperator: {
              CustomConnector: "NO_OP",
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
      },
      DependsOn: [
        "TestBucketPolicyBA12ED38",
        "TestBucket560B80BC",
        "TestProfileBC0F4812",
      ],
    });
  });
});
