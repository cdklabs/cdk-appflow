/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnFlow } from 'aws-cdk-lib/aws-appflow';
import { IConstruct } from 'constructs';
import { JdbcSmallDataScaleConnectorProfile } from './profile';
import { JdbcSmallDataScaleConnectorType } from './type';
import { AppFlowPermissionsManager } from '../core/appflow-permissions-manager';
import { ConnectorType } from '../core/connectors/connector-type';
import { ErrorHandlingConfiguration } from '../core/error-handling';
import { IFlow } from '../core/flows';
import { IDestination } from '../core/vertices/destination';
import { WriteOperationType } from '../core/write-operation';

/**
 * The definition of the Amazon AppFlow object for JdbcSmallDestination
 */
export interface JdbcSmallDataScaleObject {
  /**
   * Database schema name of the table
   */
  readonly schema: string;

  /**
   * Database table name
   */
  readonly table: string;
}

/**
 * Properties of the JdbcSmallDataScaleDestination
 */
export interface JdbcSmallDataScaleDestinationProps {

  /**
   * The profile to use with the destination
   */
  readonly profile: JdbcSmallDataScaleConnectorProfile;

  /**
   * The Amazon AppFlow Api Version
   */
  readonly apiVersion?: string;

  /**
   * The settings that determine how Amazon AppFlow handles an error when placing data in the destination. For example, this setting would determine if the flow should fail after one insertion error, or continue and attempt to insert every record regardless of the initial failure.
   */
  readonly errorHandling?: ErrorHandlingConfiguration;

  /**
   * The destination object table to write to
   */
  readonly object: JdbcSmallDataScaleObject;
}

/**
 * Represents a destination for the JDBC connector
 */
export class JdbcSmallDataScaleDestination implements IDestination {

  private static readonly defaultApiVersion = 'V1';

  public readonly connectorType: ConnectorType = JdbcSmallDataScaleConnectorType.instance;

  /**
   * Creates a new instance of the JdbcSmallDataScaleDestination
   * @param props - properties of the destination
   */
  constructor(private readonly props: JdbcSmallDataScaleDestinationProps) { }

  bind(flow: IFlow): CfnFlow.DestinationFlowConfigProperty {

    this.tryAddNodeDependency(flow, this.props.errorHandling?.errorLocation?.bucket);
    AppFlowPermissionsManager.instance().grantBucketWrite(this.props.errorHandling?.errorLocation?.bucket);
    this.tryAddNodeDependency(flow, this.props.profile);

    return {
      connectorType: this.connectorType.asProfileConnectorType,
      apiVersion: this.props.apiVersion ?? JdbcSmallDataScaleDestination.defaultApiVersion,
      connectorProfileName: this.props.profile.name,
      destinationConnectorProperties: this.buildDestinationConnectorProperties(),
    };
  }

  private buildDestinationConnectorProperties(): CfnFlow.DestinationConnectorPropertiesProperty {
    return {
      customConnector: {
        entityName: `${this.props.object.schema}.${this.props.object.table}`,
        errorHandlingConfig: this.props.errorHandling && {
          bucketName: this.props.errorHandling?.errorLocation?.bucket.bucketName,
          bucketPrefix: this.props.errorHandling?.errorLocation?.prefix,
          failOnFirstError: this.props.errorHandling.failOnFirstError,
        },
        writeOperationType: WriteOperationType.INSERT,
      },
    };
  }

  private tryAddNodeDependency(scope: IConstruct, resource?: IConstruct | string): void {
    if (resource && typeof resource !== 'string') {
      scope.node.addDependency(resource);
    }
  }
}