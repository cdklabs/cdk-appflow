/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnFlow } from "aws-cdk-lib/aws-appflow";
import { IConstruct } from "constructs";
import { MarketoConnectorType } from "./type";
import { AppFlowPermissionsManager } from "../core";
import { ConnectorType } from "../core/connectors/connector-type";
import { ErrorHandlingConfiguration } from "../core/error-handling";
import { IFlow } from "../core/flows";
import { IDestination } from "../core/vertices/destination";
import { MarketoConnectorProfile } from "../marketo/profile";

export interface MarketoDestinationProps {
  readonly profile: MarketoConnectorProfile;

  /**
   * The settings that determine how Amazon AppFlow handles an error when placing data in the Marketo destination. For example, this setting would determine if the flow should fail after one insertion error, or continue and attempt to insert every record regardless of the initial failure.
   */
  readonly errorHandling?: ErrorHandlingConfiguration;

  /**
   * The Marketo object for which the operation is to be set.
   */
  readonly object: string;
}

export class MarketoDestination implements IDestination {
  public readonly connectorType: ConnectorType = MarketoConnectorType.instance;

  constructor(private readonly props: MarketoDestinationProps) {}

  bind(flow: IFlow): CfnFlow.DestinationFlowConfigProperty {
    this.tryAddNodeDependency(
      flow,
      this.props.errorHandling?.errorLocation?.bucket,
    );
    this.tryAddNodeDependency(flow, this.props.profile);
    AppFlowPermissionsManager.instance().grantBucketWrite(
      this.props.errorHandling?.errorLocation?.bucket,
    );

    return {
      connectorType: this.connectorType.asProfileConnectorType,
      connectorProfileName: this.props.profile.name,
      destinationConnectorProperties:
        this.buildDestinationConnectorProperties(),
    };
  }

  private buildDestinationConnectorProperties(): CfnFlow.DestinationConnectorPropertiesProperty {
    return {
      marketo: {
        errorHandlingConfig: this.props.errorHandling && {
          bucketName:
            this.props.errorHandling?.errorLocation?.bucket?.bucketName,
          bucketPrefix: this.props.errorHandling?.errorLocation?.prefix,
          failOnFirstError: this.props.errorHandling.failOnFirstError,
        },
        object: this.props.object,
      },
    };
  }

  private tryAddNodeDependency(scope: IConstruct, resource?: IConstruct): void {
    if (resource) {
      scope.node.addDependency(resource);
    }
  }
}
