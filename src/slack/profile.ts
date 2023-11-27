/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { SecretValue } from 'aws-cdk-lib';
import { CfnConnectorProfile } from 'aws-cdk-lib/aws-appflow';
import { Construct } from 'constructs';
import { SlackConnectorType } from './type';
import { ConnectorProfileBase, ConnectorProfileProps } from '../core/connectors/connector-profile';

export interface SlackConnectorProfileProps extends ConnectorProfileProps {
  readonly oAuth: SlackOAuthSettings;
  readonly instanceUrl: string;
}

export interface SlackOAuthSettings {
  readonly accessToken: SecretValue;
  readonly clientId?: SecretValue;
  readonly clientSecret?: SecretValue;
}

export class SlackConnectorProfile extends ConnectorProfileBase {

  public static fromConnectionProfileArn(scope: Construct, id: string, arn: string) {
    return this._fromConnectorProfileAttributes(scope, id, { arn }) as SlackConnectorProfile;
  }

  public static fromConnectionProfileName(scope: Construct, id: string, name: string) {
    return this._fromConnectorProfileAttributes(scope, id, { name }) as SlackConnectorProfile;
  }

  constructor(scope: Construct, id: string, props: SlackConnectorProfileProps) {
    super(scope, id, props, SlackConnectorType.instance);
  }

  protected buildConnectorProfileProperties(props: ConnectorProfileProps): CfnConnectorProfile.ConnectorProfilePropertiesProperty {
    const properties = (props as SlackConnectorProfileProps);
    return {
      slack: {
        instanceUrl: properties.instanceUrl,
      },
    };
  }

  protected buildConnectorProfileCredentials(props: ConnectorProfileProps): CfnConnectorProfile.ConnectorProfileCredentialsProperty {
    const properties = (props as SlackConnectorProfileProps);
    return {
      slack: {
        accessToken: properties.oAuth.accessToken.unsafeUnwrap(),
        clientId: properties.oAuth.clientId?.unsafeUnwrap() ?? 'dummyClientId',
        clientSecret: properties.oAuth.clientSecret?.unsafeUnwrap() ?? 'dummyClientSecret',
      },
    };
  }
}