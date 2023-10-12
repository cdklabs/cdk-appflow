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
  readonly stage: SnowflakeStageDefinition;
  readonly integration?: SnowflakeStorageIntegration;
}

export interface SnowflakeBasicAuthSettings {
  readonly username: string;
  readonly password: string;
}

export interface SnowflakeStageDefinition {
  readonly warehouse: string;
  readonly database: string;
  readonly schema: string;

  /**
   * The name of the stage
   */
  readonly name: string;
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
   * @internal
   */
  public readonly _location: S3Location;

  public readonly integrationRole?: IRole;

  constructor(scope: Construct, id: string, props: SnowflakeConnectorProfileProps) {
    super(scope, id, props, SnowflakeConnectorType.instance);
    this._location = props.location;

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
        stage: `${properties.stage.database}.${properties.stage.schema}.${properties.stage.name}`,
        warehouse: properties.stage.warehouse,
        accountName: properties.account,
        region: properties.region,
      },
    };
  }
}