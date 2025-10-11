/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnConnectorProfile } from "aws-cdk-lib/aws-appflow";
import { Construct } from "constructs";
import { GitHubConnectorType } from "./type";
import { ConnectorAuthenticationType } from "../core/connectors/connector-authentication-type";
import {
  ConnectorProfileBase,
  ConnectorProfileProps,
} from "../core/connectors/connector-profile";
import { OAuth2GrantType as OAuthGrantType } from "../core/connectors/oauth2-granttype";

export interface GitHubConnectorProfileProps extends ConnectorProfileProps {
  readonly oAuth: GitHubOAuthSettings;
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
  readonly refreshToken?: string;

  /**
   * The secret of the client app.
   */
  readonly clientSecret?: string;

  /**
   * The id of the client app.
   */
  readonly clientId?: string;
}

/**
 * Represents the OAuth flow enabled for the GA4
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
   * Note that if only the access token is provided AppFlow is not able to retrieve a fresh access token when the current one is expired
   *
   * @default Retrieves a fresh accessToken with the information in the [flow property]{@link GitHubOAuthSettings#flow}
   */
  readonly accessToken?: string;

  /**
   * The OAuth flow used for obtaining a new accessToken when the old is not present or expired.
   *
   * @default undefined. AppFlow will not request any new accessToken after expiry.
   */
  readonly flow?: GitHubOAuthFlow;

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
    super(scope, id, props, GitHubConnectorType.instance);
  }

  protected buildConnectorProfileProperties(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfilePropertiesProperty {
    const properties = props as GitHubConnectorProfileProps;
    return {
      customConnector: {
        oAuth2Properties: {
          // INFO: even if we're using a refresh token grant flow this property is required
          oAuth2GrantType: OAuthGrantType.AUTHORIZATION_CODE,
          // INFO: even if we provide only the access token this property is required
          // TODO: think about if this is correct. token can be IResolvable
          tokenUrl:
            properties.oAuth.endpoints?.token ??
            GitHubConnectorProfile.defaultTokenEndpoint,
        },
      },
    };
  }

  protected buildConnectorProfileCredentials(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfileCredentialsProperty {
    const properties = props as GitHubConnectorProfileProps;

    return {
      customConnector: {
        oauth2: {
          // INFO: when using Refresh Token Grant Flow - access token property is required
          accessToken: properties.oAuth.accessToken ?? "dummyAccessToken",
          refreshToken: properties.oAuth.flow?.refreshTokenGrant.refreshToken,
          clientId: properties.oAuth.flow?.refreshTokenGrant.clientId,
          clientSecret: properties.oAuth.flow?.refreshTokenGrant.clientSecret,
        },
        authenticationType: ConnectorAuthenticationType.OAUTH2,
      },
    };
  }
}
