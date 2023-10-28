/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnFlow } from 'aws-cdk-lib/aws-appflow';
import { IConstruct } from 'constructs';
import { JdbcSmallDataScaleConnectorProfile } from './profile';
import { JdbcSmallDataScaleConnectorType } from './type';
import { ConnectorType } from '../core/connectors/connector-type';
import { IFlow } from '../core/flows';
import { ISource } from '../core/vertices/source';

export interface JdbcSmallDataScaleObject {
  readonly schema: string;
  readonly table: string;
}

export interface JdbcSmallDataScaleSourceProps {
  readonly profile: JdbcSmallDataScaleConnectorProfile;
  readonly object: JdbcSmallDataScaleObject;
  readonly apiVersion?: string;
}

export class JdbcSmallDataScaleSource implements ISource {

  private static readonly defaultApiVersion = 'V1';

  public readonly connectorType: ConnectorType = JdbcSmallDataScaleConnectorType.instance;

  constructor(private readonly props: JdbcSmallDataScaleSourceProps) { }

  bind(flow: IFlow): CfnFlow.SourceFlowConfigProperty {

    this.tryAddNodeDependency(flow, this.props.profile);

    return {
      connectorType: this.connectorType.asProfileConnectorType,
      apiVersion: this.props.apiVersion ?? JdbcSmallDataScaleSource.defaultApiVersion,
      connectorProfileName: this.props.profile.name,
      sourceConnectorProperties: this.buildSourceConnectorProperties(),
    };
  }

  private buildSourceConnectorProperties(): CfnFlow.SourceConnectorPropertiesProperty {
    return {
      customConnector: {
        entityName: `${this.props.object.schema}.${this.props.object.table}`,
      },
    };
  }

  private tryAddNodeDependency(scope: IConstruct, resource?: IConstruct | string): void {
    if (resource && typeof resource !== 'string') {
      scope.node.addDependency(resource);
    }
  }
}