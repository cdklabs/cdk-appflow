/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnFlow } from "aws-cdk-lib/aws-appflow";
import { IConstruct } from "constructs";
import { SalesforceConnectorProfile } from "./profile";
import { SalesforceDataTransferApi } from "./salesforce-data-transfer-api";
import { SalesforceConnectorType } from "./type";
import { AppFlowPermissionsManager } from "../core/appflow-permissions-manager";
import { ConnectorType } from "../core/connectors/connector-type";
import { ErrorHandlingConfiguration } from "../core/error-handling";
import { IFlow } from "../core/flows";
import { IDestination } from "../core/vertices/destination";
import { WriteOperation } from "../core/write-operation";

export interface SalesforceDestinationProps {
  readonly profile: SalesforceConnectorProfile;

  /**
   * Specifies which Salesforce API is used by Amazon AppFlow when your flow transfers data to Salesforce.
   */
  readonly dataTransferApi?: SalesforceDataTransferApi;

  /**
   * The settings that determine how Amazon AppFlow handles an error when placing data in the Salesforce destination. For example, this setting would determine if the flow should fail after one insertion error, or continue and attempt to insert every record regardless of the initial failure.
   */
  readonly errorHandling?: ErrorHandlingConfiguration;

  /**
   * The Salesforce object for which the operation is to be set.
   */
  readonly object: string;

  readonly operation: WriteOperation;
}

export class SalesforceDestination implements IDestination {
  public readonly connectorType: ConnectorType =
    SalesforceConnectorType.instance;

  constructor(private readonly props: SalesforceDestinationProps) {}

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
      destinationConnectorProperties:
        this.buildDestinationConnectorProperties(),
    };
  }

  private buildDestinationConnectorProperties(): CfnFlow.DestinationConnectorPropertiesProperty {
    return {
      salesforce: {
        dataTransferApi: this.props.dataTransferApi,
        errorHandlingConfig: this.props.errorHandling && {
          bucketName:
            this.props.errorHandling?.errorLocation?.bucket.bucketName,
          bucketPrefix: this.props.errorHandling?.errorLocation?.prefix,
          failOnFirstError: this.props.errorHandling.failOnFirstError,
        },
        idFieldNames: this.props.operation.ids,
        object: this.props.object,
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
