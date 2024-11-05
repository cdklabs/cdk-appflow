/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { SecretValue, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { Bucket } from "aws-cdk-lib/aws-s3";

import {
  Mapping,
  ZendeskConnectorProfile,
  ZendeskInstanceUrlBuilder,
  ZendeskSource,
  OnDemandFlow,
  S3Destination,
  ZendeskConnectorType,
} from "../../src";

describe("ZendeskSource", () => {
  test("Source with only connector name", () => {
    const stack = new Stack(undefined, "TestStack");
    const source = new ZendeskSource({
      profile: ZendeskConnectorProfile.fromConnectionProfileName(
        stack,
        "TestProfile",
        "dummy-profile",
      ),
      object: "dummy-object",
    });

    const expectedConnectorType = ZendeskConnectorType.instance;
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
    const source = new ZendeskSource({
      profile: ZendeskConnectorProfile.fromConnectionProfileName(
        stack,
        "TestProfile",
        "dummy-profile",
      ),
      object: "dummy-object",
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
      SourceFlowConfig: {
        ConnectorProfileName: "dummy-profile",
        ConnectorType: "Zendesk",
        SourceConnectorProperties: {
          Zendesk: {
            Object: "dummy-object",
          },
        },
      },
    });
  });

  test("Source for dummy-profile in a Flow is in the stack", () => {
    const stack = new Stack(undefined, "TestStack");

    const profile = new ZendeskConnectorProfile(stack, "TestProfile", {
      oAuth: {
        accessToken: SecretValue.unsafePlainText("accessToken"),
        clientId: SecretValue.unsafePlainText("clientId"),
        clientSecret: SecretValue.unsafePlainText("clientSecret"),
      },
      instanceUrl: ZendeskInstanceUrlBuilder.buildFromAccount("zendeskAccount"),
    });

    const source = new ZendeskSource({
      profile: profile,
      object: "dummy-object",
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
      ConnectorType: "Zendesk",
      ConnectorProfileConfig: {
        ConnectorProfileCredentials: {
          Zendesk: {
            AccessToken: "accessToken",
            ClientId: "clientId",
            ClientSecret: "clientSecret",
          },
        },
        ConnectorProfileProperties: {
          Zendesk: {
            InstanceUrl: "https://zendeskAccount.zendesk.com",
          },
        },
      },
    });

    template.hasResource("AWS::AppFlow::Flow", {
      Properties: {
        SourceFlowConfig: {
          ConnectorProfileName: "TestStackTestProfile18724107",
          ConnectorType: "Zendesk",
          SourceConnectorProperties: {
            Zendesk: {
              Object: "dummy-object",
            },
          },
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
