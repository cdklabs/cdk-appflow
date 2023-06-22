/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnFlow } from 'aws-cdk-lib/aws-appflow';
import { IConstruct } from 'constructs';
import { SAPOdataConnectorProfile } from './profile';
import { SAPOdataConnectorType } from './type';
import { S3Location } from '../core';
import { AppFlowPermissionsManager } from '../core/appflow-permissions-manager';
import { ConnectorType } from '../core/connectors/connector-type';
import { ErrorHandlingConfiguration } from '../core/error-handling';
import { IFlow } from '../core/flows';
import { IDestination } from '../core/vertices/destination';
import { WriteOperation } from '../core/write-operation';

export interface SAPOdataSuccessResponseHandlingConfiguration {
  readonly location: S3Location;
}

export interface SAPOdataDestinationProps {

  readonly profile: SAPOdataConnectorProfile;

  /**
   * The settings that determine how Amazon AppFlow handles an error when placing data in the SAPOdata destination. For example, this setting would determine if the flow should fail after one insertion error, or continue and attempt to insert every record regardless of the initial failure.
   */
  readonly errorHandling?: ErrorHandlingConfiguration;

  readonly successResponseHandling?: SAPOdataSuccessResponseHandlingConfiguration;
  /**
   * The SAPOdata object for which the operation is to be set.
   */
  readonly object: string;

  readonly operation: WriteOperation;
}

export class SAPOdataDestination implements IDestination {

  public readonly connectorType: ConnectorType = SAPOdataConnectorType.instance;

  constructor(private readonly props: SAPOdataDestinationProps) { }

  bind(flow: IFlow): CfnFlow.DestinationFlowConfigProperty {

    this.tryAddNodeDependency(flow, this.props.errorHandling?.errorLocation?.bucket);
    AppFlowPermissionsManager.instance().grantBucketWrite(this.props.errorHandling?.errorLocation?.bucket);
    this.tryAddNodeDependency(flow, this.props.profile);
    this.tryAddNodeDependency(flow, this.props.successResponseHandling?.location.bucket);
    AppFlowPermissionsManager.instance().grantBucketWrite(this.props.successResponseHandling?.location.bucket);

    return {
      connectorType: this.connectorType.asProfileConnectorType,
      connectorProfileName: this.props.profile.name,
      destinationConnectorProperties: this.buildDestinationConnectorProperties(),
    };
  }

  private buildDestinationConnectorProperties(): CfnFlow.DestinationConnectorPropertiesProperty {
    return {
      sapoData: {
        errorHandlingConfig: this.props.errorHandling && {
          bucketName: this.props.errorHandling?.errorLocation?.bucket.bucketName,
          bucketPrefix: this.props.errorHandling?.errorLocation?.prefix,
          failOnFirstError: this.props.errorHandling.failOnFirstError,
        },
        successResponseHandlingConfig: this.props.successResponseHandling?.location && {
          bucketName: this.props.successResponseHandling.location.bucket.bucketName,
        },
        idFieldNames: this.props.operation.ids,
        objectPath: this.props.object,
        writeOperationType: this.props.operation.type,
      },
    };
  }

  private tryAddNodeDependency(scope: IConstruct, resource?: IConstruct | string) {
    if (resource && typeof resource !== 'string') {
      scope.node.addDependency(resource);
    }
  }

}