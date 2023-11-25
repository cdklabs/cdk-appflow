/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { SecretValue } from 'aws-cdk-lib';
import { CfnConnectorProfile } from 'aws-cdk-lib/aws-appflow';
import { Construct } from 'constructs';
import { MicrosoftSharepointOnlineConnectorType } from './type';
import { MicrosoftSharepointOnlineTokenUrlBuilder } from './util';
import { ConnectorAuthenticationType } from '../core/connectors/connector-authentication-type';
import { ConnectorProfileBase, ConnectorProfileProps } from '../core/connectors/connector-profile';
import { OAuth2GrantType as OAuthGrantType } from '../core/connectors/oauth2-granttype';

export interface MicrosoftSharepointOnlineConnectorProfileProps extends ConnectorProfileProps {
  readonly oAuth: MicrosoftSharepointOnlineOAuthSettings;
}

export interface MicrosoftSharepointOnlineOAuthEndpointsSettings {
  readonly token: string;
}

export interface MicrosoftSharepointOnlineRefreshTokenGrantFlow {
  readonly refreshToken?: SecretValue;
  readonly clientSecret?: SecretValue;
  readonly clientId?: SecretValue;
}

export interface MicrosoftSharepointOnlineOAuthFlow {
  readonly refreshTokenGrant: MicrosoftSharepointOnlineRefreshTokenGrantFlow;
}

export interface MicrosoftSharepointOnlineOAuthSettings {

  /**
   * The access token to be used when interacting with Microsoft Sharepoint Online
   *
   * Note that if only the access token is provided AppFlow is not able to retrieve a fresh access token when the current one is expired
   */
  readonly accessToken?: SecretValue;

  readonly flow?: MicrosoftSharepointOnlineOAuthFlow;

  readonly endpoints?: MicrosoftSharepointOnlineOAuthEndpointsSettings;
}

/**
 * A class that represents a Microsoft Sharepoint Online Connector Profile.
 *
 * This connector profile allows to transfer document libraries residing on a Microsoft Sharepoint Online's site to Amazon S3.
 */
export class MicrosoftSharepointOnlineConnectorProfile extends ConnectorProfileBase {

  public static fromConnectionProfileArn(scope: Construct, id: string, arn: string) {
    return this._fromConnectorProfileAttributes(scope, id, { arn }) as MicrosoftSharepointOnlineConnectorProfile;
  }

  public static fromConnectionProfileName(scope: Construct, id: string, name: string) {
    return this._fromConnectorProfileAttributes(scope, id, { name }) as MicrosoftSharepointOnlineConnectorProfile;
  }

  private static readonly defaultTokenEndpoint = MicrosoftSharepointOnlineTokenUrlBuilder.buildTokenUrl();

  constructor(scope: Construct, id: string, props: MicrosoftSharepointOnlineConnectorProfileProps) {
    super(scope, id, props, MicrosoftSharepointOnlineConnectorType.instance);
  }

  protected buildConnectorProfileProperties(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfilePropertiesProperty {
    const properties = (props as MicrosoftSharepointOnlineConnectorProfileProps);
    return {
      customConnector: {
        oAuth2Properties: {
          // INFO: even if we're using a refresh token grant flow this property is required
          oAuth2GrantType: OAuthGrantType.AUTHORIZATION_CODE,
          // INFO: even if we provide only the access token this property is required
          // TODO: think about if this is correct. token can be IResolvable
          tokenUrl: properties.oAuth.endpoints?.token ?? MicrosoftSharepointOnlineConnectorProfile.defaultTokenEndpoint,
        },
      },
    };
  }

  protected buildConnectorProfileCredentials(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfileCredentialsProperty {
    const properties = (props as MicrosoftSharepointOnlineConnectorProfileProps);

    return {
      customConnector: {
        oauth2: {
          // INFO: when using Refresh Token Grant Flow - access token property is required
          accessToken: properties.oAuth.accessToken?.unsafeUnwrap() ?? 'dummyAccessToken',
          refreshToken: properties.oAuth.flow?.refreshTokenGrant.refreshToken?.unsafeUnwrap(),
          clientId: properties.oAuth.flow?.refreshTokenGrant.clientId?.unsafeUnwrap(),
          clientSecret: properties.oAuth.flow?.refreshTokenGrant.clientSecret?.unsafeUnwrap(),
        },
        authenticationType: ConnectorAuthenticationType.OAUTH2,
      },
    };
  }
}