/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { SecretValue, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { GitHubConnectorProfile } from "../../src/github";

describe("GitHubConnectorProfile", () => {
  test("BasicAuth with PAT", () => {
    const stack = new Stack();

    new GitHubConnectorProfile(stack, "TestProfile", {
      basicAuth: {
        username: "testuser",
        personalAccessToken: SecretValue.unsafePlainText(
          "ghp_xxxxxxxxxxxxxxxxxxxx",
        ),
      },
    });

    Template.fromStack(stack).hasResourceProperties(
      "AWS::AppFlow::ConnectorProfile",
      {
        ConnectorProfileConfig: {
          ConnectorProfileProperties: {
            CustomConnector: {},
          },
          ConnectorProfileCredentials: {
            CustomConnector: {
              AuthenticationType: "CUSTOM",
              Custom: {
                CustomAuthenticationType: "BasicAuthPersonalAccessToken",
                CredentialsMap: {
                  username: "testuser",
                  personalAccessToken: "ghp_xxxxxxxxxxxxxxxxxxxx",
                },
              },
            },
          },
        },
      },
    );
  });

  test("OAuth with access token", () => {
    const stack = new Stack();

    new GitHubConnectorProfile(stack, "TestProfile", {
      oAuth: {
        accessToken: SecretValue.unsafePlainText("accessToken"),
      },
    });

    Template.fromStack(stack).hasResourceProperties(
      "AWS::AppFlow::ConnectorProfile",
      {
        ConnectorProfileConfig: {
          ConnectorProfileProperties: {
            CustomConnector: {
              OAuth2Properties: {
                OAuth2GrantType: "AUTHORIZATION_CODE",
                TokenUrl: "https://github.com/login/oauth/access_token",
              },
            },
          },
          ConnectorProfileCredentials: {
            CustomConnector: {
              AuthenticationType: "OAUTH2",
              Oauth2: {
                AccessToken: "accessToken",
              },
            },
          },
        },
      },
    );
  });

  test("Custom token endpoint", () => {
    const stack = new Stack();

    new GitHubConnectorProfile(stack, "TestProfile", {
      oAuth: {
        accessToken: SecretValue.unsafePlainText("accessToken"),
        endpoints: {
          token: "https://custom.github.com/oauth/token",
        },
      },
    });

    Template.fromStack(stack).hasResourceProperties(
      "AWS::AppFlow::ConnectorProfile",
      {
        ConnectorProfileConfig: {
          ConnectorProfileProperties: {
            CustomConnector: {
              OAuth2Properties: {
                OAuth2GrantType: "AUTHORIZATION_CODE",
                TokenUrl: "https://custom.github.com/oauth/token",
              },
            },
          },
        },
      },
    );
  });

  test("Throws error when no authentication method is provided", () => {
    const stack = new Stack();

    expect(() => {
      new GitHubConnectorProfile(stack, "TestProfile", {});
    }).toThrow(
      "GitHub connector profile requires either basicAuth or oAuth authentication method",
    );
  });

  test("Throws error when both authentication methods are provided", () => {
    const stack = new Stack();

    expect(() => {
      new GitHubConnectorProfile(stack, "TestProfile", {
        basicAuth: {
          username: "testuser",
          personalAccessToken: SecretValue.unsafePlainText("token"),
        },
        oAuth: {
          accessToken: SecretValue.unsafePlainText("token"),
        },
      });
    }).toThrow(
      "GitHub connector profile cannot have both basicAuth and oAuth authentication methods. Choose one.",
    );
  });
});
