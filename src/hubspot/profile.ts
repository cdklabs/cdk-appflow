/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { SecretValue } from "aws-cdk-lib";
import { CfnConnectorProfile } from "aws-cdk-lib/aws-appflow";
import { Construct } from "constructs";
import { HubSpotConnectorType } from "./type";
import { ConnectorAuthenticationType } from "../core/connectors/connector-authentication-type";
import {
  ConnectorProfileBase,
  ConnectorProfileProps,
} from "../core/connectors/connector-profile";
import { OAuth2GrantType as OAuthGrantType } from "../core/connectors/oauth2-granttype";

export interface HubSpotConnectorProfileProps extends ConnectorProfileProps {
  readonly oAuth: HubSpotOAuthSettings;
}

/**
 * Hubspot OAuth token and authorization endpoints
 */
export interface HubSpotOAuthEndpoints {
  /**
   * The OAuth token endpoint URI
   */
  readonly token?: string;
}

/**
 * The OAuth elements required for the execution of the refresh token grant flow.
 */
export interface HubSpotRefreshTokenGrantFlow {
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
 * Represents the OAuth flow enabled for the GA4
 */
export interface HubSpotOAuthFlow {
  /**
   * The details required for executing the refresh token grant flow
   */
  readonly refreshTokenGrant: HubSpotRefreshTokenGrantFlow;
}

export interface HubSpotOAuthSettings {
  /**
   * The access token to be used when interacting with Hubspot
   *
   * Note that if only the access token is provided AppFlow is not able to retrieve a fresh access token when the current one is expired
   *
   * @default Retrieves a fresh accessToken with the information in the [flow property]{@link HubSpotOAuthSettings#flow}
   */
  readonly accessToken?: SecretValue;

  /**
   * The OAuth flow used for obtaining a new accessToken when the old is not present or expired.
   *
   * @default undefined. AppFlow will not request any new accessToken after expiry.
   */
  readonly flow?: HubSpotOAuthFlow;

  /**
   * The OAuth token and authorization endpoints.
   */
  readonly endpoints?: HubSpotOAuthEndpoints;
}

export class HubSpotConnectorProfile extends ConnectorProfileBase {
  public static fromConnectionProfileArn(
    scope: Construct,
    id: string,
    arn: string,
  ) {
    return this._fromConnectorProfileAttributes(scope, id, {
      arn,
    }) as HubSpotConnectorProfile;
  }

  public static fromConnectionProfileName(
    scope: Construct,
    id: string,
    name: string,
  ) {
    return this._fromConnectorProfileAttributes(scope, id, {
      name,
    }) as HubSpotConnectorProfile;
  }

  private static readonly defaultTokenEndpoint: string =
    "https://api.hubapi.com/oauth/v1/token";

  constructor(
    scope: Construct,
    id: string,
    props: HubSpotConnectorProfileProps,
  ) {
    super(scope, id, props, HubSpotConnectorType.instance);
  }

  protected buildConnectorProfileProperties(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfilePropertiesProperty {
    const properties = props as HubSpotConnectorProfileProps;
    return {
      customConnector: {
        oAuth2Properties: {
          // INFO: even if we're using a refresh token grant flow this property is required
          oAuth2GrantType: OAuthGrantType.AUTHORIZATION_CODE,
          // INFO: even if we provide only the access token this property is required
          // TODO: think about if this is correct. token can be IResolvable
          tokenUrl:
            properties.oAuth.endpoints?.token ??
            HubSpotConnectorProfile.defaultTokenEndpoint,
        },
      },
    };
  }

  protected buildConnectorProfileCredentials(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfileCredentialsProperty {
    const properties = props as HubSpotConnectorProfileProps;

    return {
      customConnector: {
        oauth2: {
          // INFO: when using Refresh Token Grant Flow - access token property is required
          accessToken:
            properties.oAuth.accessToken?.unsafeUnwrap() ?? "dummyAccessToken",
          refreshToken:
            properties.oAuth.flow?.refreshTokenGrant.refreshToken?.unsafeUnwrap(),
          clientId:
            properties.oAuth.flow?.refreshTokenGrant.clientId?.unsafeUnwrap(),
          clientSecret:
            properties.oAuth.flow?.refreshTokenGrant.clientSecret?.unsafeUnwrap(),
        },
        authenticationType: ConnectorAuthenticationType.OAUTH2,
      },
    };
  }
}
