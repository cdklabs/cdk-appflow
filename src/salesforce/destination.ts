/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnFlow } from 'aws-cdk-lib/aws-appflow';
import { IConstruct } from 'constructs';
import { SalesforceConnectorProfile } from './profile';
import { SalesforceConnectorType } from './type';
import { AppFlowPermissionsManager } from '../core/appflow-permissions-manager';
import { ConnectorType } from '../core/connectors/connector-type';
import { ErrorHandlingConfiguration } from '../core/error-handling';
import { IFlow } from '../core/flows';
import { IDestination } from '../core/vertices/destination';
import { WriteOperation } from '../core/write-operation';

/**
 * The default. Amazon AppFlow selects which API to use based on the number of records that your flow transfers to Salesforce. If your flow transfers fewer than 1,000 records, Amazon AppFlow uses Salesforce REST API. If your flow transfers 1,000 records or more, Amazon AppFlow uses Salesforce Bulk API 2.0.
 *
 * Each of these Salesforce APIs structures data differently. If Amazon AppFlow selects the API automatically, be aware that, for recurring flows, the data output might vary from one flow run to the next. For example, if a flow runs daily, it might use REST API on one day to transfer 900 records, and it might use Bulk API 2.0 on the next day to transfer 1,100 records. For each of these flow runs, the respective Salesforce API formats the data differently. Some of the differences include how dates are formatted and null values are represented. Also, Bulk API 2.0 doesn't transfer Salesforce compound fields.
 *
 * By choosing this option, you optimize flow performance for both small and large data transfers, but the tradeoff is inconsistent formatting in the output.
 */
export enum SalesforceDataTransferApi {

  AUTOMATIC = 'AUTOMATIC',
  BULKV2 = 'BULKV2',
  REST_SYNC = 'REST_SYNC'
}

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

  public readonly connectorType: ConnectorType = SalesforceConnectorType.instance;

  constructor(private readonly props: SalesforceDestinationProps) { }

  bind(flow: IFlow): CfnFlow.DestinationFlowConfigProperty {

    this.tryAddNodeDependency(flow, this.props.errorHandling?.errorLocation?.bucket);
    AppFlowPermissionsManager.instance().grantBucketWrite(this.props.errorHandling?.errorLocation?.bucket);
    this.tryAddNodeDependency(flow, this.props.profile);

    return {
      connectorType: this.connectorType.asProfileConnectorType,
      connectorProfileName: this.props.profile.name,
      destinationConnectorProperties: this.buildDestinationConnectorProperties(),
    };
  }

  private buildDestinationConnectorProperties(): CfnFlow.DestinationConnectorPropertiesProperty {
    return {
      salesforce: {
        dataTransferApi: this.props.dataTransferApi,
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

  private tryAddNodeDependency(scope: IConstruct, resource?: IConstruct | string) {
    if (resource && typeof resource !== 'string') {
      scope.node.addDependency(resource);
    }
  }

}