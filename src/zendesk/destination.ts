/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnFlow } from 'aws-cdk-lib/aws-appflow';
import { IConstruct } from 'constructs';
import { ZendeskConnectorType } from './type';
import { ConnectorType } from '../core/connectors/connector-type';
import { ErrorHandlingConfiguration } from '../core/error-handling';
import { IFlow } from '../core/flows';
import { IDestination } from '../core/vertices/destination';
import { WriteOperation } from '../core/write-operation';
import { ZendeskConnectorProfile } from '../zendesk/profile';

export interface ZendeskDestinationProps {

  readonly profile: ZendeskConnectorProfile;

  /**
   * The settings that determine how Amazon AppFlow handles an error when placing data in the Zendesk destination. For example, this setting would determine if the flow should fail after one insertion error, or continue and attempt to insert every record regardless of the initial failure.
   */
  readonly errorHandling?: ErrorHandlingConfiguration;

  /**
   * The Zendesk object for which the operation is to be performed.
   */
  readonly object: string;

  readonly operation: WriteOperation;
}

export class ZendeskDestination implements IDestination {

  public readonly connectorType: ConnectorType = ZendeskConnectorType.instance;

  constructor(private readonly props: ZendeskDestinationProps) { }

  bind(flow: IFlow): CfnFlow.DestinationFlowConfigProperty {

    this.tryAddNodeDependency(flow, this.props.errorHandling?.errorLocation?.bucket);
    this.tryAddNodeDependency(flow, this.props.profile);

    return {
      connectorType: this.connectorType.asProfileConnectorType,
      connectorProfileName: this.props.profile.name,
      destinationConnectorProperties: this.buildDestinationConnectorProperties(),
    };
  }

  private buildDestinationConnectorProperties(): CfnFlow.DestinationConnectorPropertiesProperty {
    return {
      zendesk: {
        errorHandlingConfig: this.props.errorHandling && {
          bucketName: this.props.errorHandling?.errorLocation?.bucket.bucketName,
          bucketPrefix: this.props.errorHandling?.errorLocation?.prefix,
          failOnFirstError: this.props.errorHandling.failOnFirstError,
        },
        idFieldNames: this.props.operation.ids,
        object: this.props.object,
        writeOperationType: this.props.operation.type,
      },
    };
  }

  private tryAddNodeDependency(scope: IConstruct, resource?: IConstruct): void {
    if (resource) {
      scope.node.addDependency(resource);
    }
  }

}