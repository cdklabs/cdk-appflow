/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnConnectorProfile } from 'aws-cdk-lib/aws-appflow';
import { Construct } from 'constructs';
import { GoogleAnalytics4ConnectorType } from './type';
import { ConnectorAuthenticationType } from '../core/connectors/connector-authentication-type';
import { ConnectorProfileBase, ConnectorProfileProps } from '../core/connectors/connector-profile';
import { OAuth2GrantType as OAuthGrantType } from '../core/connectors/oauth2-granttype';

export interface GoogleAnalytics4ConnectorProfileProps extends ConnectorProfileProps {
  readonly oAuth: GoogleAnalytics4OAuthSettings;
}

/**
 * Google's OAuth token and authorization endpoints
 */
export interface GoogleAnalytics4OAuthEndpoints {
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
export interface GoogleAnalytics4RefreshTokenGrantFlow {
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
export interface GoogleAnalytics4OAuthFlow {
  /**
   * The details required for executing the refresh token grant flow
   */
  readonly refreshTokenGrant: GoogleAnalytics4RefreshTokenGrantFlow;
}

export interface GoogleAnalytics4OAuthSettings {

  /**
   * The access token to be used when interacting with Google Analytics 4
   *
   * Note that if only the access token is provided AppFlow is not able to retrieve a fresh access token when the current one is expired
   *
   * @default Retrieves a fresh accessToken with the information in the [flow property]{@link GoogleAnalytics4OAuthSettings#flow}
   */
  readonly accessToken?: string;

  /**
   * The OAuth flow used for obtaining a new accessToken when the old is not present or expired.
   *
   * @default undefined. AppFlow will not request any new accessToken after expiry.
   */
  readonly flow?: GoogleAnalytics4OAuthFlow;

  /**
   * The OAuth token and authorization endpoints.
   */
  readonly endpoints?: GoogleAnalytics4OAuthEndpoints;
}

export class GoogleAnalytics4ConnectorProfile extends ConnectorProfileBase {

  public static fromConnectionProfileArn(scope: Construct, id: string, arn: string) {
    return this._fromConnectorProfileAttributes(scope, id, { arn }) as GoogleAnalytics4ConnectorProfile;
  }

  public static fromConnectionProfileName(scope: Construct, id: string, name: string) {
    return this._fromConnectorProfileAttributes(scope, id, { name }) as GoogleAnalytics4ConnectorProfile;
  }

  private static readonly defaultTokenEndpoint: string = 'https://oauth2.googleapis.com/token';

  constructor(scope: Construct, id: string, props: GoogleAnalytics4ConnectorProfileProps) {
    super(scope, id, props, GoogleAnalytics4ConnectorType.instance);
  }

  protected buildConnectorProfileProperties(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfilePropertiesProperty {
    const properties = (props as GoogleAnalytics4ConnectorProfileProps);
    return {
      customConnector: {
        oAuth2Properties: {
          // INFO: even if we're using a refresh token grant flow this property is required
          oAuth2GrantType: OAuthGrantType.AUTHORIZATION_CODE,
          // INFO: even if we provide only the access token this property is required
          // TODO: think about if this is correct. token can be IResolvable
          tokenUrl: properties.oAuth.endpoints?.token ?? GoogleAnalytics4ConnectorProfile.defaultTokenEndpoint,
        },
      },
    };
  }

  protected buildConnectorProfileCredentials(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfileCredentialsProperty {
    const properties = (props as GoogleAnalytics4ConnectorProfileProps);

    return {
      customConnector: {
        oauth2: {
          // INFO: when using Refresh Token Grant Flow - access token property is required
          accessToken: properties.oAuth.accessToken ?? 'dummyAccessToken',
          refreshToken: properties.oAuth.flow?.refreshTokenGrant.refreshToken,
          clientId: properties.oAuth.flow?.refreshTokenGrant.clientId,
          clientSecret: properties.oAuth.flow?.refreshTokenGrant.clientSecret,
        },
        authenticationType: ConnectorAuthenticationType.OAUTH2,
      },
    };
  }
}