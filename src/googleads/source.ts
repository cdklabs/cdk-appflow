/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnFlow } from 'aws-cdk-lib/aws-appflow';
import { IConstruct } from 'constructs';
import { GoogleAdsConnectorProfile } from './profile';
import { GoogleAdsConnectorType } from './type';
import { ConnectorType } from '../core/connectors/connector-type';
import { IFlow } from '../core/flows';
import { ISource } from '../core/vertices';
/**
 * Properties of a Google Ads Source
 */
export interface GoogleAdsSourceProps {
  readonly profile: GoogleAdsConnectorProfile;
  readonly apiVersion: string;
  readonly object: string;
}
/**
 * A class that represents a Google Ads v4 Source
 */
export class GoogleAdsSource implements ISource {
  /**
     * The AppFlow type of the connector that this source is implemented for
     */
  public readonly connectorType: ConnectorType = GoogleAdsConnectorType.instance;

  constructor(private readonly props: GoogleAdsSourceProps) { }

  bind(scope: IFlow): CfnFlow.SourceFlowConfigProperty {

    this.tryAddNodeDependency(scope, this.props.profile);

    return {
      connectorType: this.connectorType.asProfileConnectorType,
      connectorProfileName: this.props.profile.name,
      apiVersion: this.props.apiVersion,
      sourceConnectorProperties: this.buildSourceConnectorProperties(),
    };
  }

  private buildSourceConnectorProperties(): CfnFlow.SourceConnectorPropertiesProperty {
    return {
      customConnector: {
        entityName: this.props.object,
      },
    };
  }
  private tryAddNodeDependency(scope: IConstruct, resource?: IConstruct | string): void {
    if (resource && typeof resource !== 'string') {
      scope.node.addDependency(resource);
    }
  }
}
