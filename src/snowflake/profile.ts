/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnConnectorProfile } from 'aws-cdk-lib/aws-appflow';
import { ArnPrincipal, Effect, IRole, PolicyDocument, PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { SnowflakeConnectorType } from './type';
import { AppFlowPermissionsManager } from '../core/appflow-permissions-manager';
import { ConnectorProfileBase, ConnectorProfileProps } from '../core/connectors/connector-profile';
import { S3Location } from '../core/s3-location';

/**
 * Properties for a Snowflake connectorprofile
 */
export interface SnowflakeConnectorProfileProps extends ConnectorProfileProps {
  readonly basicAuth: SnowflakeBasicAuthSettings;
  readonly location: S3Location;
  readonly region?: string;
  readonly account: string;

  /**
   * The name of the Snowflake warehouse
   */
  readonly warehouse: string;

  /**
   * The name of the Snowflake database
   */
  readonly database: string;

  /**
   * The name of the Snowflake schema
   *
   * @default PUBLIC
   */
  readonly schema?: string;

  /**
   * The name of the Snowflake stage
   */
  readonly stage: string;

  /**
   * Details of the Snowflake Storage Integration.
   * When provided, this construct will automatically create an IAM Role allowing access to the S3 Bucket which will be available as a [integrationROle property]{@link SnowflakeConnectorProfile#integrationRole}
   *
   * For details of the integration see {@link https://docs.snowflake.com/en/user-guide/data-load-s3-config-storage-integration}
   */
  readonly integration?: SnowflakeStorageIntegration;
}

/**
 * Snowflake authorization settings required for the profile
 */
export interface SnowflakeBasicAuthSettings {
  readonly username: string;
  readonly password: string;
}

export interface SnowflakeStorageIntegration {
  readonly storageUserArn: string;
  readonly externalId: string;
}

export class SnowflakeConnectorProfile extends ConnectorProfileBase {

  public static fromConnectionProfileArn(scope: Construct, id: string, arn: string) {
    return this._fromConnectorProfileAttributes(scope, id, { arn }) as SnowflakeConnectorProfile;
  }

  public static fromConnectionProfileName(scope: Construct, id: string, name: string) {
    return this._fromConnectorProfileAttributes(scope, id, { name }) as SnowflakeConnectorProfile;
  }

  /**
   * Default Snowflake schema if no schema provided
   */
  private static readonly defaultSchema: string = 'PUBLIC';

  /**
   * This field is used by the SnowflakeDestination to remove repetition
   *
   * @internal
   */
  public readonly _location: S3Location;

  /**
   * This field is used by the SnowflakeDestination to remove repetition
   *
   * @internal
   */
  public readonly _database: string;

  /**
   * This field is used by the SnowflakeDestination to remove repetition
   *
   * @internal
   */
  public readonly _schema: string;

  /**
   * The AWS IAM Role for the storage integration with Snowflake. Available only if [SnowflakeConnectorProfileProps's integration property]{@link SnowflakeConnectorProfileProps#integration} is provided.
   *
   * For more details see {@link https://docs.snowflake.com/en/user-guide/data-load-s3-config-storage-integration}
   */
  public readonly integrationRole?: IRole;


  constructor(scope: Construct, id: string, props: SnowflakeConnectorProfileProps) {
    super(scope, id, props, SnowflakeConnectorType.instance);
    this._location = props.location;
    this._database = props.database;
    this._schema = props.schema ?? SnowflakeConnectorProfile.defaultSchema;


    this.integrationRole = this.tryCreateRole(scope, id, props);
  }

  // INFO: maybe move it to an external class so that it can be either used here or used in any subsequent deployment?
  private tryCreateRole(scope: Construct, id: string, props: ConnectorProfileProps): IRole | undefined {

    const properties = (props as SnowflakeConnectorProfileProps);
    const integration = properties.integration;

    if (!integration) {
      return undefined;
    }

    // INFO: following https://docs.snowflake.com/en/user-guide/data-load-s3-config-storage-integration#configuring-secure-access-to-cloud-storage
    // TODO: currently, the implementation allows read-only access. Make sure that we don't need the write permissions
    return new Role(scope, `${id}IntegrationRole`, {
      assumedBy: new ArnPrincipal(integration.storageUserArn),
      externalIds: [integration.externalId],
      inlinePolicies: {
        SnowflakeAccess: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:GetObjectVersion',
              ],
              resources: [properties.location.bucket.arnForObjects(
                properties.location.prefix ?? '*',
              )],
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: [
                's3:ListBucket',
                's3:GetBucketLocation',
              ],
              resources: [properties.location.bucket.bucketArn],
              conditions: {
                StringLike: {
                  's3:prefix': [properties.location.prefix ?? '*'],
                },
              },
            }),
          ],
        }),
      },
    });
  }

  protected buildConnectorProfileCredentials(props: ConnectorProfileProps): CfnConnectorProfile.ConnectorProfileCredentialsProperty {

    const properties = (props as SnowflakeConnectorProfileProps);

    return {
      snowflake: {
        username: properties.basicAuth.username,
        password: properties.basicAuth.password,
      },
    };
  }

  protected buildConnectorProfileProperties(props: ConnectorProfileProps): CfnConnectorProfile.ConnectorProfilePropertiesProperty {
    const properties = (props as SnowflakeConnectorProfileProps);

    this.tryAddNodeDependency(this, properties.location.bucket);
    AppFlowPermissionsManager.instance().grantBucketReadWrite(properties.location.bucket);

    return {
      snowflake: {
        bucketName: properties.location.bucket.bucketName,
        bucketPrefix: properties.location.prefix,
        stage: `${properties.database}.${properties.schema}.${properties.stage}`,
        warehouse: properties.warehouse,
        accountName: properties.account,
        region: properties.region,
      },
    };
  }
}