/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnConnectorProfile } from 'aws-cdk-lib/aws-appflow';
import { Construct } from 'constructs';
import { SalesforceMarketingCloudConnectorType } from './type';
import { ConnectorAuthenticationType } from '../core/connectors/connector-authentication-type';
import { ConnectorProfileBase, ConnectorProfileProps } from '../core/connectors/connector-profile';
import { OAuth2GrantType as OAuthGrantType } from '../core/connectors/oauth2-granttype';

export interface SalesforceMarketingCloudConnectorProfileProps extends ConnectorProfileProps {
  readonly oAuth: SalesforceMarketingCloudOAuthSettings;
  readonly instanceUrl: string;
}

export interface SalesforceMarketingCloudOAuthEndpoints {
  readonly token: string;
}

export interface SalesforceMarketingCloudOAuthClientSettings {
  readonly clientId: string;
  readonly clientSecret: string;
}

export interface SalesforceMarketingCloudFlowSettings {
  readonly clientCredentials: SalesforceMarketingCloudOAuthClientSettings;
}

export interface SalesforceMarketingCloudOAuthSettings {
  readonly accessToken?: string;
  readonly flow?: SalesforceMarketingCloudFlowSettings;
  readonly endpoints: SalesforceMarketingCloudOAuthEndpoints;
}

export class SalesforceMarketingCloudConnectorProfile extends ConnectorProfileBase {

  public static fromConnectionProfileArn(scope: Construct, id: string, arn: string) {
    return this._fromConnectorProfileAttributes(scope, id, { arn }) as SalesforceMarketingCloudConnectorProfile;
  }

  public static fromConnectionProfileName(scope: Construct, id: string, name: string) {
    return this._fromConnectorProfileAttributes(scope, id, { name }) as SalesforceMarketingCloudConnectorProfile;
  }

  constructor(scope: Construct, id: string, props: SalesforceMarketingCloudConnectorProfileProps) {
    super(scope, id, props, SalesforceMarketingCloudConnectorType.instance);
  }

  protected buildConnectorProfileProperties(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfilePropertiesProperty {
    const properties = (props as SalesforceMarketingCloudConnectorProfileProps);
    return {
      customConnector: {
        oAuth2Properties: {
          oAuth2GrantType: OAuthGrantType.CLIENT_CREDENTIALS,
          tokenUrl: properties.oAuth.endpoints.token,
        },
        profileProperties: {
          instanceUrl: properties.instanceUrl,
        },
      },
    };
  }

  protected buildConnectorProfileCredentials(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfileCredentialsProperty {
    const properties = (props as SalesforceMarketingCloudConnectorProfileProps);
    return {
      customConnector: {
        oauth2: {
          accessToken: properties.oAuth.accessToken,
          clientId: properties.oAuth.flow?.clientCredentials.clientId,
          clientSecret: properties.oAuth.flow?.clientCredentials.clientSecret,
        },
        authenticationType: ConnectorAuthenticationType.OAUTH2,
      },
    };
  }
}