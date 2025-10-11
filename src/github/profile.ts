/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { SecretValue } from "aws-cdk-lib";
import { CfnConnectorProfile } from "aws-cdk-lib/aws-appflow";
import { Construct } from "constructs";
import { GitHubConnectorType } from "./type";
import { ConnectorAuthenticationType } from "../core/connectors/connector-authentication-type";
import {
  ConnectorProfileBase,
  ConnectorProfileProps,
} from "../core/connectors/connector-profile";
import { OAuth2GrantType } from "../core/connectors/oauth2-granttype";

export interface GitHubConnectorProfileProps extends ConnectorProfileProps {
  readonly oAuth?: GitHubOAuthSettings;
  readonly basicAuth?: GitHubBasicAuthSettings;
}

/**
 * GitHub Basic Authentication settings using Personal Access Token
 */
export interface GitHubBasicAuthSettings {
  /**
   * Personal Access Token for GitHub authentication
   */
  readonly personalAccessToken: SecretValue;

  /**
   * GitHub username
   */
  readonly username: string;
}

/**
 * GitHub's OAuth token and authorization endpoints
 */
export interface GitHubOAuthEndpoints {
  /**
   * The OAuth token endpoint URI
   */
  readonly token?: string;
}

/**
 * The OAuth elements required for the execution of the refresh token grant flow.
 */
export interface GitHubRefreshTokenGrantFlow {
  /**
   * A non-expired refresh token.
   */
  readonly refreshToken?: SecretValue;

  /**
   * The secret of the client app.
   */
  readonly clientSecret?: SecretValue;

  /**
   * The id of the client app.
   */
  readonly clientId?: SecretValue;
}

/**
 * Represents the OAuth flow enabled for GitHub
 */
export interface GitHubOAuthFlow {
  /**
   * The details required for executing the refresh token grant flow
   */
  readonly refreshTokenGrant: GitHubRefreshTokenGrantFlow;
}

export interface GitHubOAuthSettings {
  /**
   * The access token to be used when interacting with GitHub
   *
   * Note: Currently only non-expiring access tokens are supported as
   * "User access tokens that expire are currently an optional feature and are subject to change."
   */
  readonly accessToken: SecretValue;

  /**
   * The OAuth token and authorization endpoints.
   */
  readonly endpoints?: GitHubOAuthEndpoints;
}

export class GitHubConnectorProfile extends ConnectorProfileBase {
  public static fromConnectionProfileArn(
    scope: Construct,
    id: string,
    arn: string,
  ) {
    return this._fromConnectorProfileAttributes(scope, id, {
      arn,
    }) as GitHubConnectorProfile;
  }

  public static fromConnectionProfileName(
    scope: Construct,
    id: string,
    name: string,
  ) {
    return this._fromConnectorProfileAttributes(scope, id, {
      name,
    }) as GitHubConnectorProfile;
  }

  private static readonly defaultTokenEndpoint: string =
    "https://github.com/login/oauth/access_token";

  constructor(
    scope: Construct,
    id: string,
    props: GitHubConnectorProfileProps,
  ) {
    // Validate that exactly one authentication method is provided
    const hasBasicAuth = !!props.basicAuth;
    const hasOAuth = !!props.oAuth;

    if (!hasBasicAuth && !hasOAuth) {
      throw new Error(
        "GitHub connector profile requires either basicAuth or oAuth authentication method",
      );
    }

    if (hasBasicAuth && hasOAuth) {
      throw new Error(
        "GitHub connector profile cannot have both basicAuth and oAuth authentication methods. Choose one.",
      );
    }

    super(scope, id, props, GitHubConnectorType.instance);
  }

  protected buildConnectorProfileProperties(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfilePropertiesProperty {
    const properties = props as GitHubConnectorProfileProps;

    if (properties.basicAuth) {
      return {
        customConnector: {},
      };
    }

    return {
      customConnector: {
        oAuth2Properties: {
          oAuth2GrantType: OAuth2GrantType.AUTHORIZATION_CODE,
          tokenUrl:
            properties.oAuth?.endpoints?.token ??
            GitHubConnectorProfile.defaultTokenEndpoint,
        },
      },
    };
  }

  protected buildConnectorProfileCredentials(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfileCredentialsProperty {
    const properties = props as GitHubConnectorProfileProps;

    if (properties.basicAuth) {
      return {
        customConnector: {
          custom: {
            customAuthenticationType: "BasicAuthPersonalAccessToken",
            credentialsMap: {
              username: properties.basicAuth.username,
              personalAccessToken:
                properties.basicAuth.personalAccessToken.unsafeUnwrap(),
            },
          },
          authenticationType: ConnectorAuthenticationType.CUSTOM,
        },
      };
    }

    return {
      customConnector: {
        oauth2: {
          accessToken: properties.oAuth?.accessToken?.unsafeUnwrap(),
        },
        authenticationType: ConnectorAuthenticationType.OAUTH2,
      },
    };
  }
}
