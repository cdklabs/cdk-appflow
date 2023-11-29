/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { SecretValue } from 'aws-cdk-lib';
import { CfnConnectorProfile } from 'aws-cdk-lib/aws-appflow';
import { Construct } from 'constructs';
import { AmazonRdsForPostgreSqlConnectorType } from './type';
import { ConnectorAuthenticationType } from '../core';
import { ConnectorProfileBase, ConnectorProfileProps } from '../core/connectors/connector-profile';

export interface AmazonRdsForPostgreSqlConnectorProfileProps extends ConnectorProfileProps {
  readonly basicAuth: AmazonRdsForPostgreSqlBasicAuthSettings;
  readonly hostname: string;
  readonly port?: number;
  readonly database: string;
}

export interface AmazonRdsForPostgreSqlBasicAuthSettings {
  readonly username: string;
  readonly password: SecretValue;
}

export class AmazonRdsForPostgreSqlConnectorProfile extends ConnectorProfileBase {

  public static fromConnectionProfileArn(scope: Construct, id: string, arn: string) {
    return this._fromConnectorProfileAttributes(scope, id, { arn }) as AmazonRdsForPostgreSqlConnectorProfile;
  }

  public static fromConnectionProfileName(scope: Construct, id: string, name: string) {
    return this._fromConnectorProfileAttributes(scope, id, { name }) as AmazonRdsForPostgreSqlConnectorProfile;
  }

  private static readonly defaultPort: number = 5432;

  constructor(scope: Construct, id: string, props: AmazonRdsForPostgreSqlConnectorProfileProps) {
    super(scope, id, props, AmazonRdsForPostgreSqlConnectorType.instance);
  }

  protected buildConnectorProfileProperties(_props: ConnectorProfileProps): CfnConnectorProfile.ConnectorProfilePropertiesProperty {
    return {
      customConnector: {
        profileProperties: {},
      },
    };
  }

  protected buildConnectorProfileCredentials(props: ConnectorProfileProps): CfnConnectorProfile.ConnectorProfileCredentialsProperty {
    const properties = (props as AmazonRdsForPostgreSqlConnectorProfileProps);
    return {
      customConnector: {
        authenticationType: ConnectorAuthenticationType.CUSTOM,
        custom: {
          credentialsMap: {
            username: properties.basicAuth.username,
            password: properties.basicAuth.password.unsafeUnwrap(),
            driver: 'postgresql',
            hostname: properties.hostname,
            port: properties.port ? `${properties.port}` : AmazonRdsForPostgreSqlConnectorProfile.defaultPort.toString(),
            database: properties.database,
          },
          customAuthenticationType: 'CUSTOM',
        },
      },
    };
  }
}