/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnFlow } from 'aws-cdk-lib/aws-appflow';
import { IConstruct } from 'constructs';
import { EventBridgeConnectorType } from './type';
import { AppFlowPermissionsManager } from '../core/appflow-permissions-manager';
import { ConnectorType } from '../core/connectors/connector-type';
import { ErrorHandlingConfiguration } from '../core/error-handling';
import { FlowType, IFlow } from '../core/flows';
import { IDestination } from '../core/vertices/destination';

/**
 * The properties for the EventBridge destination
 */
export interface EventBridgeDestinationProps {
  readonly partnerBus: string;
  readonly errorHandling?: ErrorHandlingConfiguration;
}

/**
 * This class represents AppFlow's EventBridge destination
 */
export class EventBridgeDestination implements IDestination {

  private readonly compatibleFlows: FlowType[] = [FlowType.EVENT];
  public readonly connectorType: ConnectorType = EventBridgeConnectorType.instance;

  constructor(private readonly props: EventBridgeDestinationProps) { }

  bind(flow: IFlow): CfnFlow.DestinationFlowConfigProperty {

    if (!this.compatibleFlows.includes(flow.type)) {
      throw new Error(`Flow of type ${flow.type} does not support EventBridge as a destination`);
    }

    this.tryAddNodeDependency(flow, this.props.errorHandling?.errorLocation?.bucket);
    AppFlowPermissionsManager.instance().grantBucketWrite(this.props.errorHandling?.errorLocation?.bucket);

    return {
      connectorType: this.connectorType.asProfileConnectorType,
      destinationConnectorProperties: this.buildDestinationConnectorProperties(),
    };
  }

  private buildDestinationConnectorProperties(): CfnFlow.DestinationConnectorPropertiesProperty {
    return {
      eventBridge: {
        object: this.props.partnerBus,
        errorHandlingConfig: this.props.errorHandling && {
          bucketName: this.props.errorHandling?.errorLocation?.bucket?.bucketName,
          bucketPrefix: this.props.errorHandling?.errorLocation?.prefix,
          failOnFirstError: this.props.errorHandling?.failOnFirstError,
        },
      },
    };
  }

  private tryAddNodeDependency(scope: IConstruct, resource?: IConstruct | string): void {
    if (resource && typeof resource !== 'string') {
      scope.node.addDependency(resource);
    }
  }
}