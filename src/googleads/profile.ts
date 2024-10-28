/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { SecretValue } from "aws-cdk-lib";
import { CfnConnectorProfile } from "aws-cdk-lib/aws-appflow";
import { Construct } from "constructs";
import { GoogleAdsConnectorType } from "./type";
import { ConnectorAuthenticationType } from "../core/connectors/connector-authentication-type";
import {
  ConnectorProfileBase,
  ConnectorProfileProps,
} from "../core/connectors/connector-profile";
import { OAuth2GrantType as OAuthGrantType } from "../core/connectors/oauth2-granttype";

export interface GoogleAdsConnectorProfileProps extends ConnectorProfileProps {
  readonly oAuth: GoogleAdsOAuthSettings;
  readonly apiVersion: string;
  readonly managerID?: SecretValue;
  readonly developerToken: SecretValue;
}
/**
 * Google's OAuth token and authorization endpoints
 */
export interface GoogleAdsOAuthEndpoints {
  /**
   * The OAuth token endpoint URI
   */
  readonly token?: string;
  /**
   * The OAuth authorization endpoint URI
   */
  readonly authorization?: string;
}
/**
 * The OAuth elements required for the execution of the refresh token grant flow.
 */
export interface GoogleAdsRefreshTokenGrantFlow {
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
 * Represents the OAuth flow enabled for the GoogleAds
 */
export interface GoogleAdsOAuthFlow {
  /**
   * The details required for executing the refresh token grant flow
   */
  readonly refreshTokenGrant: GoogleAdsRefreshTokenGrantFlow;
}
export interface GoogleAdsOAuthSettings {
  /**
   * The access token to be used when interacting with Google Ads
   *
   * Note that if only the access token is provided AppFlow is not able to retrieve a fresh access token when the current one is expired
   *
   * @default Retrieves a fresh accessToken with the information in the [flow property]{@link GoogleAdsOAuthSettings#flow}
   */
  readonly accessToken?: SecretValue;
  /**
   * The OAuth flow used for obtaining a new accessToken when the old is not present or expired.
   *
   * @default undefined. AppFlow will not request any new accessToken after expiry.
   */
  readonly flow?: GoogleAdsOAuthFlow;
  /**
   * The OAuth token and authorization endpoints.
   */
  readonly endpoints?: GoogleAdsOAuthEndpoints;
}

export class GoogleAdsConnectorProfile extends ConnectorProfileBase {
  public static fromConnectionProfileArn(
    scope: Construct,
    id: string,
    arn: string,
  ) {
    return this._fromConnectorProfileAttributes(scope, id, {
      arn,
    }) as GoogleAdsConnectorProfile;
  }
  public static fromConnectionProfileName(
    scope: Construct,
    id: string,
    name: string,
  ) {
    return this._fromConnectorProfileAttributes(scope, id, {
      name,
    }) as GoogleAdsConnectorProfile;
  }

  private static readonly defaultTokenEndpoint: string =
    "https://oauth2.googleapis.com/token";

  constructor(
    scope: Construct,
    id: string,
    props: GoogleAdsConnectorProfileProps,
  ) {
    super(scope, id, props, GoogleAdsConnectorType.instance);
  }

  protected buildConnectorProfileProperties(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfilePropertiesProperty {
    const properties = props as GoogleAdsConnectorProfileProps;
    return {
      customConnector: {
        profileProperties: {
          developerToken: properties.developerToken.unsafeUnwrap(),
          apiVersion: properties.apiVersion,
          managerID:
            properties.managerID?.unsafeUnwrap() as any /* can be undefined */,
        },
        oAuth2Properties: {
          // INFO: even if we're using a refresh token grant flow this property is required
          oAuth2GrantType: OAuthGrantType.AUTHORIZATION_CODE,
          // INFO: even if we provide only the access token this property is required
          tokenUrl:
            properties.oAuth.endpoints?.token ??
            GoogleAdsConnectorProfile.defaultTokenEndpoint,
        },
      },
    };
  }

  protected buildConnectorProfileCredentials(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfileCredentialsProperty {
    const properties = props as GoogleAdsConnectorProfileProps;

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
