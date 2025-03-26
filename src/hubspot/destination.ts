/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnFlow } from "aws-cdk-lib/aws-appflow";
import { IConstruct } from "constructs";
import { HubSpotConnectorProfile } from "./profile";
import { HubSpotConnectorType } from "./type";
import { HubSpotApiVersion } from "./util";
import { AppFlowPermissionsManager } from "../core/appflow-permissions-manager";
import { ConnectorType } from "../core/connectors/connector-type";
import { ErrorHandlingConfiguration } from "../core/error-handling";
import { IFlow } from "../core/flows";
import { IDestination } from "../core/vertices/destination";
import { WriteOperation } from "../core/write-operation";

export interface HubSpotDestinationProps {
  readonly profile: HubSpotConnectorProfile;
  readonly apiVersion: HubSpotApiVersion;
  readonly entity: string[];
  readonly operation: WriteOperation;

  /**
   * The settings that determine how Amazon AppFlow handles an error when placing data in the HubSpot destination. For example, this setting would determine if the flow should fail after one insertion error, or continue and attempt to insert every record regardless of the initial failure.
   */
  readonly errorHandling?: ErrorHandlingConfiguration;
}

export class HubSpotDestination implements IDestination {
  public readonly connectorType: ConnectorType = HubSpotConnectorType.instance;

  constructor(private readonly props: HubSpotDestinationProps) {}

  bind(flow: IFlow): CfnFlow.DestinationFlowConfigProperty {
    this.tryAddNodeDependency(
      flow,
      this.props.errorHandling?.errorLocation?.bucket,
    );
    AppFlowPermissionsManager.instance().grantBucketWrite(
      this.props.errorHandling?.errorLocation?.bucket,
    );
    this.tryAddNodeDependency(flow, this.props.profile);

    return {
      connectorType: this.connectorType.asProfileConnectorType,
      connectorProfileName: this.props.profile.name,
      apiVersion: this.props.apiVersion,
      destinationConnectorProperties:
        this.buildDestinationConnectorProperties(),
    };
  }

  private buildDestinationConnectorProperties(): CfnFlow.DestinationConnectorPropertiesProperty {
    return {
      customConnector: {
        entityName: this.props.entity.join("/"),
        errorHandlingConfig: this.props.errorHandling && {
          bucketName:
            this.props.errorHandling?.errorLocation?.bucket.bucketName,
          bucketPrefix: this.props.errorHandling?.errorLocation?.prefix,
          failOnFirstError: this.props.errorHandling.failOnFirstError,
        },
        writeOperationType: this.props.operation.type,
      },
    };
  }

  private tryAddNodeDependency(
    scope: IConstruct,
    resource?: IConstruct | string,
  ) {
    if (resource && typeof resource !== "string") {
      scope.node.addDependency(resource);
    }
  }
}
