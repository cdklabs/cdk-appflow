/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnConnectorProfile } from 'aws-cdk-lib/aws-appflow';
import { Construct } from 'constructs';
import { ZendeskConnectorType } from './type';
import { ConnectorProfileBase, ConnectorProfileProps } from '../core/connectors/connector-profile';

export interface ZendeskConnectorProfileProps extends ConnectorProfileProps {
  readonly oAuth: ZendeskOAuthSettings;
  readonly instanceUrl: string;
}

/**
 * Zendesk OAuth client settings.
 *
 * Note: Zendesk access tokens don't expire and don't use refresh tokens. Zendesk access tokens are valid until revoked.
 *       That is why there is no flow for refreshing the access token nor refreshToken property to be set.
 */
export interface ZendeskOAuthSettings {
  /**
   * Zendesk access token to the OAuth client
   *
   * Note: Zendesk access tokens don't expire and don't use refresh tokens.
   */
  readonly accessToken: string;

  /**
   * The OAuth Zendesk client id
   */
  readonly clientId: string;

  /**
   * The OAuth Zendesk client secret
   */
  readonly clientSecret: string;
}

export class ZendeskConnectorProfile extends ConnectorProfileBase {

  public static fromConnectionProfileArn(scope: Construct, id: string, arn: string) {
    return this._fromConnectorProfileAttributes(scope, id, { arn }) as ZendeskConnectorProfile;
  }

  public static fromConnectionProfileName(scope: Construct, id: string, name: string) {
    return this._fromConnectorProfileAttributes(scope, id, { name }) as ZendeskConnectorProfile;
  }

  constructor(scope: Construct, id: string, props: ZendeskConnectorProfileProps) {
    super(scope, id, props, ZendeskConnectorType.instance);
  }

  protected buildConnectorProfileProperties(props: ConnectorProfileProps): CfnConnectorProfile.ConnectorProfilePropertiesProperty {
    const properties = (props as ZendeskConnectorProfileProps);
    return {
      zendesk: {
        instanceUrl: properties.instanceUrl,
      },
    };
  }

  protected buildConnectorProfileCredentials(props: ConnectorProfileProps): CfnConnectorProfile.ConnectorProfileCredentialsProperty {
    const properties = (props as ZendeskConnectorProfileProps);
    return {
      zendesk: {
        accessToken: properties.oAuth.accessToken,
        clientId: properties.oAuth.clientId,
        clientSecret: properties.oAuth.clientSecret,
      },
    };
  }
}