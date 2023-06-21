/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnFlow } from 'aws-cdk-lib/aws-appflow';
import { IConstruct } from 'constructs';
import { SalesforceConnectorProfile } from './profile';
import { SalesforceConnectorType } from './type';
import { ConnectorType } from '../core/connectors/connector-type';
import { IFlow } from '../core/flows';
import { ISource } from '../core/vertices/source';

export interface SalesforceSourceProps {
  readonly profile: SalesforceConnectorProfile;
  readonly object: string;
  readonly apiVersion?: string;
  readonly enableDynamicFieldUpdate?: boolean;
  readonly includeDeletedRecords?: boolean;
}

export class SalesforceSource implements ISource {

  public readonly connectorType: ConnectorType = SalesforceConnectorType.instance;

  constructor(private readonly props: SalesforceSourceProps) { }

  bind(flow: IFlow): CfnFlow.SourceFlowConfigProperty {

    this.tryAddNodeDependency(flow, this.props.profile);

    return {
      connectorType: this.connectorType.asProfileConnectorType,
      connectorProfileName: this.props.profile.name,
      apiVersion: this.props.apiVersion,
      sourceConnectorProperties: this.buildSourceConnectorProperties(),
    };
  }

  private buildSourceConnectorProperties(): CfnFlow.SourceConnectorPropertiesProperty {
    return {
      salesforce: {
        enableDynamicFieldUpdate: this.props.enableDynamicFieldUpdate,
        includeDeletedRecords: this.props.includeDeletedRecords,
        object: this.props.object,
      },
    };
  }

  private tryAddNodeDependency(scope: IConstruct, resource?: IConstruct | string): void {
    if (resource && typeof resource !== 'string') {
      scope.node.addDependency(resource);
    }
  }
}