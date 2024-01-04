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

/**
 * Properties of the AmazonRdsForPostgreSqlConnectorProfile
 */
export interface AmazonRdsForPostgreSqlConnectorProfileProps extends ConnectorProfileProps {
  /**
   * The auth settings for the profile
   */
  readonly basicAuth: AmazonRdsForPostgreSqlBasicAuthSettings;
  /**
   * The PostgreSQL hostname
   */
  readonly hostname: string;
  /**
   * The PostgreSQL communication port
   */
  readonly port?: number;

  /**
   * The name of the PostgreSQL database
   */
  readonly database: string;
}

/**
 * Basic authentication settings for the AmazonRdsForPostgreSqlConnectorProfile
 */
export interface AmazonRdsForPostgreSqlBasicAuthSettings {
  /**
   * The username of the identity used for interacting with the Amazon RDS for PostgreSQL
   */
  readonly username: string;

  /**
   * The password of the identity used for interacting with the Amazon RDS for PostgreSQL
   */
  readonly password: SecretValue;
}

/**
 * The connector profile for the Amazon RDS for PostgreSQL connector
 */
export class AmazonRdsForPostgreSqlConnectorProfile extends ConnectorProfileBase {

  /**
   * Imports an existing AmazonRdsForPostgreSqlConnectorProfile
   * @param scope the scope for the connector profile
   * @param id the connector profile's ID
   * @param arn the ARN for the existing connector profile
   * @returns An instance of the AmazonRdsForPostreSqlConnectorProfile
   */
  public static fromConnectionProfileArn(scope: Construct, id: string, arn: string) {
    return this._fromConnectorProfileAttributes(scope, id, { arn }) as AmazonRdsForPostgreSqlConnectorProfile;
  }

  /**
   * Imports an existing AmazonRdsForPostgreSqlConnectorProfile
   * @param scope the scope for the connector profile
   * @param id the connector profile's ID
   * @param name the name for the existing connector profile
   * @returns An instance of the AmazonRdsForPostreSqlConnectorProfile
   */
  public static fromConnectionProfileName(scope: Construct, id: string, name: string) {
    return this._fromConnectorProfileAttributes(scope, id, { name }) as AmazonRdsForPostgreSqlConnectorProfile;
  }

  private static readonly defaultPort: number = 5432;

  /**
   * Creates a new instance of the AmazonRdsForPostgreSqlConnectorProfile
   * @param scope the Construct scope for this connector profile
   * @param id the id of this connector profile
   * @param props properties to use when instantiating this connector profile
   */
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