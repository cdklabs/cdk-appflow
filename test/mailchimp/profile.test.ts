/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { SecretValue, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { MailchimpConnectorProfile } from "../../src";

describe("MailchimpConnectorProfileProps", () => {
  test("API Key profile with credentials exists in the stack", () => {
    const stack = new Stack(undefined, "TestStack", {
      env: { account: "12345678", region: "dummy" },
    });

    new MailchimpConnectorProfile(stack, "TestProfile", {
      apiKey: SecretValue.unsafePlainText("apiKey"),
      instanceUrl: SecretValue.unsafePlainText("instanceUrl").toString(),
    });

    Template.fromStack(stack).hasResourceProperties(
      "AWS::AppFlow::ConnectorProfile",
      {
        ConnectionMode: "Public",
        ConnectorLabel: "Mailchimp",
        ConnectorProfileName: "TestProfile",
        ConnectorType: "CustomConnector",
        ConnectorProfileConfig: {
          ConnectorProfileCredentials: {
            CustomConnector: {
              AuthenticationType: "CUSTOM",
              Custom: {
                CredentialsMap: {
                  api_key: "apiKey",
                },
                CustomAuthenticationType: "api_key",
              },
            },
          },
          ConnectorProfileProperties: {
            CustomConnector: {
              ProfileProperties: {
                instanceUrl: "instanceUrl",
              },
            },
          },
        },
      },
    );
  });
});
