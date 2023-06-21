/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnConnectorProfile } from 'aws-cdk-lib/aws-appflow';
import { Construct } from 'constructs';
import { MarketoConnectorType } from './type';
import { ConnectorProfileBase, ConnectorProfileProps } from '../core/connectors/connector-profile';

export interface MarketoConnectorProfileProps extends ConnectorProfileProps {
  readonly oAuth: MarketoOAuthSettings;
  readonly instanceUrl: string;
}

export interface MarketoOAuthClientCredentialsFlow {
  readonly clientId: string;
  readonly clientSecret: string;
}

export interface MarketoOAuthFlow {
  readonly clientCredentials: MarketoOAuthClientCredentialsFlow;
}

export interface MarketoOAuthSettings {
  readonly accessToken?: string;
  readonly flow: MarketoOAuthFlow;
}

export class MarketoConnectorProfile extends ConnectorProfileBase {

  public static fromConnectionProfileArn(scope: Construct, id: string, arn: string) {
    return this._fromConnectorProfileAttributes(scope, id, { arn }) as MarketoConnectorProfile;
  }

  public static fromConnectionProfileName(scope: Construct, id: string, name: string) {
    return this._fromConnectorProfileAttributes(scope, id, { name }) as MarketoConnectorProfile;
  }

  constructor(scope: Construct, id: string, props: MarketoConnectorProfileProps) {
    super(scope, id, props, MarketoConnectorType.instance);
  }

  protected buildConnectorProfileProperties(props: ConnectorProfileProps): CfnConnectorProfile.ConnectorProfilePropertiesProperty {
    const properties = (props as MarketoConnectorProfileProps);
    return {
      marketo: {
        instanceUrl: properties.instanceUrl,
      },
    };
  }

  protected buildConnectorProfileCredentials(props: ConnectorProfileProps): CfnConnectorProfile.ConnectorProfileCredentialsProperty {
    const properties = (props as MarketoConnectorProfileProps);
    return {
      marketo: {
        accessToken: properties.oAuth.accessToken,
        clientId: properties.oAuth.flow.clientCredentials.clientId,
        clientSecret: properties.oAuth.flow.clientCredentials.clientSecret,
      },
    };
  }
}