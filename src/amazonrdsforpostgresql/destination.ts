/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnFlow } from 'aws-cdk-lib/aws-appflow';
import { IConstruct } from 'constructs';
import { AmazonRdsForPostgreSqlConnectorProfile } from './profile';
import { AmazonRdsForPostgreSqlConnectorType } from './type';
import { AppFlowPermissionsManager } from '../core/appflow-permissions-manager';
import { ConnectorType } from '../core/connectors/connector-type';
import { ErrorHandlingConfiguration } from '../core/error-handling';
import { IFlow } from '../core/flows';
import { IDestination } from '../core/vertices/destination';
import { WriteOperationType } from '../core/write-operation';

export interface AmazonRdsForPostgreSqlObject {
  readonly schema: string;
  readonly table: string;
}

export interface AmazonRdsForPostgreSqlDestinationProps {
  readonly profile: AmazonRdsForPostgreSqlConnectorProfile;

  readonly apiVersion?: string;

  /**
   * The settings that determine how Amazon AppFlow handles an error when placing data in the destination. For example, this setting would determine if the flow should fail after one insertion error, or continue and attempt to insert every record regardless of the initial failure.
   */
  readonly errorHandling?: ErrorHandlingConfiguration;

  readonly object: AmazonRdsForPostgreSqlObject;
}

export class AmazonRdsForPostgreSqlDestination implements IDestination {

  private static readonly defaultApiVersion = '1.0';

  public readonly connectorType: ConnectorType = AmazonRdsForPostgreSqlConnectorType.instance;

  constructor(private readonly props: AmazonRdsForPostgreSqlDestinationProps) { }

  bind(flow: IFlow): CfnFlow.DestinationFlowConfigProperty {

    this.tryAddNodeDependency(flow, this.props.errorHandling?.errorLocation?.bucket);
    AppFlowPermissionsManager.instance().grantBucketWrite(this.props.errorHandling?.errorLocation?.bucket);
    this.tryAddNodeDependency(flow, this.props.profile);

    return {
      connectorType: this.connectorType.asProfileConnectorType,
      apiVersion: this.props.apiVersion ?? AmazonRdsForPostgreSqlDestination.defaultApiVersion,
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