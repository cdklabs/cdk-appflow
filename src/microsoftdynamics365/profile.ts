/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { SecretValue } from 'aws-cdk-lib';
import { CfnConnectorProfile } from 'aws-cdk-lib/aws-appflow';
import { Construct } from 'constructs';
import { MicrosoftDynamics365ConnectorType } from './type';
import { MicrosoftDynamics365TokenUrlBuilder } from './util';
import { ConnectorAuthenticationType } from '../core/connectors/connector-authentication-type';
import { ConnectorProfileBase, ConnectorProfileProps } from '../core/connectors/connector-profile';
import { OAuth2GrantType as OAuthGrantType } from '../core/connectors/oauth2-granttype';

export interface MicrosoftDynamics365ConnectorProfileProps extends ConnectorProfileProps {
  readonly oAuth: MicrosoftDynamics365OAuthSettings;
  readonly instanceUrl: string;
}

export interface MicrosoftDynamics365OAuthEndpointsSettings {
  readonly token: string;
}

export interface MicrosoftDynamics365RefreshTokenGrantFlow {
  readonly refreshToken?: SecretValue;
  readonly clientSecret?: SecretValue;
  readonly clientId?: SecretValue;
}

export interface MicrosoftDynamics365OAuthFlow {
  readonly refreshTokenGrant: MicrosoftDynamics365RefreshTokenGrantFlow;
}

export interface MicrosoftDynamics365OAuthSettings {

  /**
   * The access token to be used when interacting with Microsoft Dynamics 365
   *
   * Note that if only the access token is provided AppFlow is not able to retrieve a fresh access token when the current one is expired
   */
  readonly accessToken?: SecretValue;

  readonly flow?: MicrosoftDynamics365OAuthFlow;

  readonly endpoints?: MicrosoftDynamics365OAuthEndpointsSettings;
}

/**
 * A class that represents a Microsoft Dynamics 365 Connector Profile.
 *
 * This connector profile allows to transfer document libraries residing on a Microsoft Dynamics 365's site to Amazon S3.
 */
export class MicrosoftDynamics365ConnectorProfile extends ConnectorProfileBase {

  public static fromConnectionProfileArn(scope: Construct, id: string, arn: string) {
    return this._fromConnectorProfileAttributes(scope, id, { arn }) as MicrosoftDynamics365ConnectorProfile;
  }

  public static fromConnectionProfileName(scope: Construct, id: string, name: string) {
    return this._fromConnectorProfileAttributes(scope, id, { name }) as MicrosoftDynamics365ConnectorProfile;
  }

  private static readonly defaultTokenEndpoint = MicrosoftDynamics365TokenUrlBuilder.buildTokenUrl();

  constructor(scope: Construct, id: string, props: MicrosoftDynamics365ConnectorProfileProps) {
    super(scope, id, props, MicrosoftDynamics365ConnectorType.instance);
  }

  protected buildConnectorProfileProperties(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfilePropertiesProperty {
    const properties = (props as MicrosoftDynamics365ConnectorProfileProps);
    return {
      customConnector: {
        profileProperties: {
          instanceUrl: properties.instanceUrl,
        },
        oAuth2Properties: {
          // INFO: even if we're using a refresh token grant flow this property is required
          oAuth2GrantType: OAuthGrantType.AUTHORIZATION_CODE,
          // INFO: even if we provide only the access token this property is required
          // TODO: think about if this is correct. token can be IResolvable
          tokenUrl: properties.oAuth.endpoints?.token ?? MicrosoftDynamics365ConnectorProfile.defaultTokenEndpoint,
        },
      },
    };
  }

  protected buildConnectorProfileCredentials(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfileCredentialsProperty {
    const properties = (props as MicrosoftDynamics365ConnectorProfileProps);

    return {
      customConnector: {
        oauth2: {
          // INFO: when using Refresh Token Grant Flow - access token property is required
          accessToken: properties.oAuth.accessToken?.unsafeUnwrap() ?? 'dummyAccessToken',
          refreshToken: properties.oAuth.flow?.refreshTokenGrant.refreshToken?.unsafeUnwrap() ?? 'dummyRefreshToken',
          clientId: properties.oAuth.flow?.refreshTokenGrant.clientId?.unsafeUnwrap(),
          clientSecret: properties.oAuth.flow?.refreshTokenGrant.clientSecret?.unsafeUnwrap(),
        },
        authenticationType: ConnectorAuthenticationType.OAUTH2,
      },
    };
  }
}