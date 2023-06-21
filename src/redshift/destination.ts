/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { ITable } from '@aws-cdk/aws-redshift-alpha';
import { CfnFlow } from 'aws-cdk-lib/aws-appflow';
import { IConstruct } from 'constructs';
import { RedshiftConnectorProfile } from './profile';
import { RedshiftConnectorType } from './type';
import { ErrorHandlingConfiguration, IFlow } from '../core';
import { AppFlowPermissionsManager } from '../core/appflow-permissions-manager';
import { ConnectorType } from '../core/connectors/connector-type';
import { IDestination } from '../core/vertices';

export interface RedshiftDestinationObject {
  readonly table: string | ITable;

  /**
   * @default public
   */
  readonly schema?: string;
}

export interface RedshiftDestinationProps {
  /**
   * An instance of the @type RedshiftConnectorProfile
   */
  readonly profile: RedshiftConnectorProfile;

  /**
   * A Redshift table object (optionally with the schema).
   */
  readonly object: RedshiftDestinationObject;

  /**
   * The settings that determine how Amazon AppFlow handles an error when placing data in the Salesforce destination. For example, this setting would determine if the flow should fail after one insertion error, or continue and attempt to insert every record regardless of the initial failure.
   */
  readonly errorHandling?: ErrorHandlingConfiguration;
}

export class RedshiftDestination implements IDestination {

  private readonly defaultSchema: string = 'public';
  public readonly connectorType: ConnectorType = RedshiftConnectorType.instance;

  constructor(private readonly props: RedshiftDestinationProps) { }

  bind(scope: IFlow): CfnFlow.DestinationFlowConfigProperty {

    this.tryAddNodeDependency(scope, this.props.errorHandling?.errorLocation?.bucket);
    AppFlowPermissionsManager.instance().grantBucketWrite(this.props.errorHandling?.errorLocation?.bucket);
    this.tryAddNodeDependency(scope, this.props.profile);
    this.tryAddNodeDependency(scope, this.props.object.table);
    // NOTE: interesting case that the profile requires to have the table created
    //       without it the deployment failed
    this.tryAddNodeDependency(this.props.profile, this.props.object.table);

    return {
      connectorType: this.connectorType.asProfileConnectorType,
      connectorProfileName: this.props.profile.name,
      destinationConnectorProperties: this.buildDestinationConnectorProperties(),
    };
  }

  private buildDestinationConnectorProperties(): CfnFlow.DestinationConnectorPropertiesProperty {
    return {
      redshift: {
        errorHandlingConfig: this.props.errorHandling && {
          bucketName: this.props.errorHandling?.errorLocation?.bucket.bucketName,
          bucketPrefix: this.props.errorHandling?.errorLocation?.prefix,
          failOnFirstError: this.props.errorHandling.failOnFirstError,
        },
        // TODO: identify if this needs to be the same as the bucketName/prefix in the profile
        //       for now that is the assumption and we're pulling this data from the profile
        intermediateBucketName: this.props.profile._location.bucket.bucketName,
        bucketPrefix: this.props.profile._location.prefix,
        object: this.buildObject(this.props.object.table, this.props.object.schema),
      },
    };
  }

  private buildObject(table: ITable | string, schema?: string) {
    const _schema = schema ?? this.defaultSchema;

    if (typeof table === 'string') {
      return `${_schema}.${table}`;
    }

    return `${_schema}.${table.tableName}`;
  }

  private tryAddNodeDependency(scope: IConstruct, resource?: IConstruct | string): void {
    if (resource && typeof resource !== 'string') {
      scope.node.addDependency(resource);
    }
  }
}