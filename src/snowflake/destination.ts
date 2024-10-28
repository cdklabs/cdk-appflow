/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnFlow } from "aws-cdk-lib/aws-appflow";
import { IConstruct } from "constructs";
import { SnowflakeConnectorProfile } from "./profile";
import { SnowflakeConnectorType } from "./type";
import { ErrorHandlingConfiguration, IFlow } from "../core";
import { AppFlowPermissionsManager } from "../core/appflow-permissions-manager";
import { ConnectorType } from "../core/connectors/connector-type";
import { IDestination } from "../core/vertices";

/**
 * The destination table in Snowflake. The table needs to reside in the databas and schema provided in the profile.
 */
export interface SnowflakeDestinationObject {
  /**
   * The name of the table object
   */
  readonly table: string;
}

/**
 * Properties that are required to create a Snowflake destination.
 */
export interface SnowflakeDestinationProps {
  /**
   * A Snowflake connector profile instance.
   */
  readonly profile: SnowflakeConnectorProfile;

  /**
   * A Snowflake table object (optionally with the schema).
   */
  readonly object: SnowflakeDestinationObject;

  /**
   * The settings that determine how Amazon AppFlow handles an error when placing data in the Salesforce destination. For example, this setting would determine if the flow should fail after one insertion error, or continue and attempt to insert every record regardless of the initial failure.
   */
  readonly errorHandling?: ErrorHandlingConfiguration;
}

/**
 * A Snowflake destination.
 */
export class SnowflakeDestination implements IDestination {
  private readonly _connectorType: ConnectorType =
    SnowflakeConnectorType.instance;

  public get connectorType(): ConnectorType {
    return this._connectorType;
  }

  constructor(private readonly props: SnowflakeDestinationProps) {}

  bind(scope: IFlow): CfnFlow.DestinationFlowConfigProperty {
    this.tryAddNodeDependency(
      scope,
      this.props.errorHandling?.errorLocation?.bucket,
    );
    AppFlowPermissionsManager.instance().grantBucketWrite(
      this.props.errorHandling?.errorLocation?.bucket,
    );
    this.tryAddNodeDependency(scope, this.props.profile);

    return {
      connectorType: this.connectorType.asProfileConnectorType,
      connectorProfileName: this.props.profile.name,
      destinationConnectorProperties:
        this.buildDestinationConnectorProperties(),
    };
  }

  private buildDestinationConnectorProperties(): CfnFlow.DestinationConnectorPropertiesProperty {
    return {
      snowflake: {
        errorHandlingConfig: this.props.errorHandling && {
          bucketName:
            this.props.errorHandling?.errorLocation?.bucket.bucketName,
          bucketPrefix: this.props.errorHandling?.errorLocation?.prefix,
          failOnFirstError: this.props.errorHandling.failOnFirstError,
        },
        // TODO: identify if this needs to be the same as the bucketName/prefix in the profile
        //       for now that is the assumption and we're pulling this data from the profile
        intermediateBucketName: this.props.profile._location.bucket.bucketName,
        bucketPrefix: this.props.profile._location.prefix,
        object: this.buildObject(
          this.props.profile._database,
          this.props.object.table,
          this.props.profile._schema,
        ),
      },
    };
  }

  private buildObject(database: string, table: string, schema: string) {
    return `${database}.${schema}.${table}`;
  }

  private tryAddNodeDependency(
    scope: IConstruct,
    resource?: IConstruct | string,
  ): void {
    if (resource && typeof resource !== "string") {
      scope.node.addDependency(resource);
    }
  }
}
