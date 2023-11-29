/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { SecretValue } from 'aws-cdk-lib';
import { CfnConnectorProfile } from 'aws-cdk-lib/aws-appflow';
import { Construct } from 'constructs';
import { JdbcSmallDataScaleConnectorType } from './type';
import { ConnectorAuthenticationType } from '../core';
import { ConnectorProfileBase, ConnectorProfileProps } from '../core/connectors/connector-profile';

export enum JdbcDriver {
  POSTGRES = 'postgresql',
  MYSQL = 'mysql'
}

export interface JdbcSmallDataScaleConnectorProfileProps extends ConnectorProfileProps {
  readonly basicAuth: JdbcSmallDataScaleBasicAuthSettings;
  readonly hostname: string;
  readonly port: number;
  readonly database: string;
  readonly driver: JdbcDriver;
}

export interface JdbcSmallDataScaleBasicAuthSettings {
  readonly username: string;
  readonly password: SecretValue;
}

export class JdbcSmallDataScaleConnectorProfile extends ConnectorProfileBase {

  public static fromConnectionProfileArn(scope: Construct, id: string, arn: string) {
    return this._fromConnectorProfileAttributes(scope, id, { arn }) as JdbcSmallDataScaleConnectorProfile;
  }

  public static fromConnectionProfileName(scope: Construct, id: string, name: string) {
    return this._fromConnectorProfileAttributes(scope, id, { name }) as JdbcSmallDataScaleConnectorProfile;
  }

  constructor(scope: Construct, id: string, props: JdbcSmallDataScaleConnectorProfileProps) {
    super(scope, id, props, JdbcSmallDataScaleConnectorType.instance);
  }

  protected buildConnectorProfileProperties(_props: ConnectorProfileProps): CfnConnectorProfile.ConnectorProfilePropertiesProperty {
    return {
      customConnector: {
        profileProperties: {},
      },
    };
  }

  protected buildConnectorProfileCredentials(props: ConnectorProfileProps): CfnConnectorProfile.ConnectorProfileCredentialsProperty {
    const properties = (props as JdbcSmallDataScaleConnectorProfileProps);
    return {
      customConnector: {
        authenticationType: ConnectorAuthenticationType.CUSTOM,
        custom: {
          credentialsMap: {
            username: properties.basicAuth.username,
            password: properties.basicAuth.password.unsafeUnwrap(),
            driver: properties.driver,
            hostname: properties.hostname,
            port: `${properties.port}`,
            database: properties.database,
          },
          customAuthenticationType: 'CUSTOM',
        },
      },
    };
  }
}