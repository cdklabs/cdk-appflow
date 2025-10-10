/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { SecretValue, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { Key } from "aws-cdk-lib/aws-kms";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";

import { HubSpotConnectorProfile } from "../../src";

describe("HubSpotConnectorProfileProps", () => {
  test("OAuth2 profile with direct client credentials exists in the stack", () => {
    const stack = new Stack(undefined, "TestStack", {
      env: { account: "12345678", region: "dummy" },
    });

    new HubSpotConnectorProfile(stack, "TestProfile", {
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
    });
    Template.fromStack(stack).hasResourceProperties(
      "AWS::AppFlow::ConnectorProfile",
      {
        ConnectionMode: "Public",
        ConnectorLabel: "HubSpot",
        ConnectorProfileName: "TestStackTestProfile18724107",
        ConnectorType: "CustomConnector",
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
                TokenUrl: "https://api.hubapi.com/oauth/v1/token",
              },
            },
          },
        },
      },
    );
  });

  test("OAuth2 profile with a dedicated KMS key and client credentials as secret elements exists in the stack", () => {
    const stack = new Stack(undefined, "TestStack", {
      env: { account: "12345678", region: "dummy" },
    });

    const key = new Key(stack, "TestKey");

    const secret = new Secret(stack, "TestSecret");

    new HubSpotConnectorProfile(stack, "TestProfile", {
      key: key,
      oAuth: {
        accessToken: secret.secretValueFromJson("accessToken"),
        flow: {
          refreshTokenGrant: {
            refreshToken: secret.secretValueFromJson("refreshToken"),
            clientId: secret.secretValueFromJson("clientId"),
            clientSecret: secret.secretValueFromJson("clientSecret"),
          },
        },
        endpoints: {
          token: "https://hubspot.custom.corp/oauth/token",
        },
      },
    });

    Template.fromStack(stack).hasResource("AWS::AppFlow::ConnectorProfile", {
      DependsOn: ["TestKey4CACAF33"],
      Properties: {
        ConnectionMode: "Public",
        ConnectorLabel: "HubSpot",
        ConnectorProfileConfig: {
          ConnectorProfileCredentials: {
            CustomConnector: {
              AuthenticationType: "OAUTH2",
              Oauth2: {
                AccessToken: {
                  "Fn::Join": [
                    "",
                    [
                      "{{resolve:secretsmanager:",
                      {
                        Ref: "TestSecret16AF87B1",
                      },
                      ":SecretString:accessToken::}}",
                    ],
                  ],
                },
                ClientId: {
                  "Fn::Join": [
                    "",
                    [
                      "{{resolve:secretsmanager:",
                      {
                        Ref: "TestSecret16AF87B1",
                      },
                      ":SecretString:clientId::}}",
                    ],
                  ],
                },
                ClientSecret: {
                  "Fn::Join": [
                    "",
                    [
                      "{{resolve:secretsmanager:",
                      {
                        Ref: "TestSecret16AF87B1",
                      },
                      ":SecretString:clientSecret::}}",
                    ],
                  ],
                },
                RefreshToken: {
                  "Fn::Join": [
                    "",
                    [
                      "{{resolve:secretsmanager:",
                      {
                        Ref: "TestSecret16AF87B1",
                      },
                      ":SecretString:refreshToken::}}",
                    ],
                  ],
                },
              },
            },
          },
          ConnectorProfileProperties: {
            CustomConnector: {
              OAuth2Properties: {
                OAuth2GrantType: "AUTHORIZATION_CODE",
                TokenUrl: "https://hubspot.custom.corp/oauth/token",
              },
            },
          },
        },
        ConnectorProfileName: "TestStackTestProfile18724107",
        ConnectorType: "CustomConnector",
        KMSArn: {
          "Fn::GetAtt": ["TestKey4CACAF33", "Arn"],
        },
      },
      Type: "AWS::AppFlow::ConnectorProfile",
    });
  });
});
