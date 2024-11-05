/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { SecretValue, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { Bucket } from "aws-cdk-lib/aws-s3";

import {
  Mapping,
  SlackConnectorProfile,
  SlackInstanceUrlBuilder,
  SlackSource,
  OnDemandFlow,
  S3Destination,
  SlackConnectorType,
} from "../../src";

describe("SlackSource", () => {
  test("Source with only connector name", () => {
    const stack = new Stack(undefined, "TestStack");
    const source = new SlackSource({
      profile: SlackConnectorProfile.fromConnectionProfileName(
        stack,
        "TestProfile",
        "dummy-profile",
      ),
      object: "dummy-object",
    });

    const expectedConnectorType = SlackConnectorType.instance;
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
    const source = new SlackSource({
      profile: SlackConnectorProfile.fromConnectionProfileName(
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
        ConnectorType: "Slack",
        SourceConnectorProperties: {
          Slack: {
            Object: "dummy-object",
          },
        },
      },
    });
  });

  test("Source for dummy-profile in a Flow is in the stack", () => {
    const stack = new Stack(undefined, "TestStack");

    const profile = new SlackConnectorProfile(stack, "TestProfile", {
      oAuth: {
        accessToken: SecretValue.unsafePlainText("accessToken"),
        clientId: SecretValue.unsafePlainText("clientId"),
        clientSecret: SecretValue.unsafePlainText("clientSecret"),
      },
      instanceUrl: SlackInstanceUrlBuilder.buildFromWorkspace("slackWorkspace"),
    });

    const source = new SlackSource({
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
      ConnectorType: "Slack",
      ConnectorProfileConfig: {
        ConnectorProfileCredentials: {
          Slack: {
            AccessToken: "accessToken",
            ClientId: "clientId",
            ClientSecret: "clientSecret",
          },
        },
        ConnectorProfileProperties: {
          Slack: {
            InstanceUrl: "https://slackWorkspace.slack.com",
          },
        },
      },
    });

    template.hasResource("AWS::AppFlow::Flow", {
      Properties: {
        SourceFlowConfig: {
          ConnectorProfileName: "TestStackTestProfile18724107",
          ConnectorType: "Slack",
          SourceConnectorProperties: {
            Slack: {
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
