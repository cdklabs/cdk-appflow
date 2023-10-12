/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnConnectorProfile } from 'aws-cdk-lib/aws-appflow';
import { ISecret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { SalesforceConnectorType } from './type';
import { ConnectorProfileBase, ConnectorProfileProps } from '../core/connectors/connector-profile';

export interface SalesforceConnectorProfileProps extends ConnectorProfileProps {
  readonly oAuth: SalesforceOAuthSettings;
  readonly instanceUrl: string;

  /**
   * @default false
   */
  readonly isSandbox?: boolean;
}

// TODO: it can be either
//       1) accessToken+refreshToken (and it will be stored as-is)
//       2) refreshToken+client (and then a refresh Token renewal will trigger following: https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_refresh_token_flow.htm&type=5)
//       3) client + authCode + redirectUri (and then potentially a Lambda is required)
//       For now only 1) and 2) are implemented, but 3) is not possible due to the requirement of a user's creds

export interface SalesforceOAuthRefreshTokenGrantFlow {
  readonly refreshToken?: string;
  readonly client?: ISecret;
}

export interface SalesforceOAuthFlow {

  readonly refreshTokenGrant: SalesforceOAuthRefreshTokenGrantFlow;
}

export interface SalesforceOAuthSettings {
  readonly accessToken?: string;
  readonly flow?: SalesforceOAuthFlow;
}

export class SalesforceConnectorProfile extends ConnectorProfileBase {

  public static fromConnectionProfileArn(scope: Construct, id: string, arn: string) {
    return this._fromConnectorProfileAttributes(scope, id, { arn }) as SalesforceConnectorProfile;
  }

  public static fromConnectionProfileName(scope: Construct, id: string, name: string) {
    return this._fromConnectorProfileAttributes(scope, id, { name }) as SalesforceConnectorProfile;
  }

  constructor(scope: Construct, id: string, props: SalesforceConnectorProfileProps) {
    super(scope, id, props, SalesforceConnectorType.instance);
    this.tryAddNodeDependency(this, props.oAuth.flow?.refreshTokenGrant.client);
  }

  protected buildConnectorProfileProperties(properties: ConnectorProfileProps): CfnConnectorProfile.ConnectorProfilePropertiesProperty {
    const props = properties as SalesforceConnectorProfileProps;
    return {
      salesforce: {
        isSandboxEnvironment: props.isSandbox,
        instanceUrl: props.instanceUrl,
      },
    };
  }

  protected buildConnectorProfileCredentials(properties: ConnectorProfileProps): CfnConnectorProfile.ConnectorProfileCredentialsProperty {
    const props = properties as SalesforceConnectorProfileProps;

    let salesforce: { [key: string]: any } = {};

    salesforce.accessToken = props.oAuth.accessToken;
    salesforce.refreshToken = props.oAuth.flow?.refreshTokenGrant.refreshToken ?? 'dummyRefreshToken';

    if (props.oAuth.flow?.refreshTokenGrant.client) {
      salesforce.clientCredentialsArn = props.oAuth.flow.refreshTokenGrant.client.secretArn;
      // TODO: make sure why this doesn't work.
      //       this doc says it should: https://docs.aws.amazon.com/appflow/latest/userguide/salesforce.html
      //       in order to obtain the access token I needed to follow: https://medium.com/@bpmmendis94/obtain-access-refresh-tokens-from-salesforce-rest-api-a324fe4ccd9b
      salesforce.accessToken = salesforce.accessToken ?? 'dummyAccessToken';
    }

    return {
      salesforce: salesforce,
    };
  }
}