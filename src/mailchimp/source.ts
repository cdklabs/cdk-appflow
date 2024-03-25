/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnFlow } from 'aws-cdk-lib/aws-appflow';
import { IConstruct } from 'constructs';
import { MailChimpConnectorProfile } from './profile';
import { MailChimpConnectorType } from './type';
import { ConnectorType } from '../core/connectors/connector-type';
import { IFlow } from '../core/flows';
import { ISource } from '../core/vertices';

export interface MailChimpSourceProps {
  readonly profile: MailChimpConnectorProfile;
  readonly apiVersion: string;
  readonly object: string;
}

/**
 * A class that represents a MailChimp v3 Source
 */
export class MailChimpSource implements ISource {

  /**
   * The AppFlow type of the connector that this source is implemented for
   */
  public readonly connectorType: ConnectorType = MailChimpConnectorType.instance;

  constructor(private readonly props: MailChimpSourceProps) {
  }

  bind(flow: IFlow): CfnFlow.SourceFlowConfigProperty {

    this.tryAddNodeDependency(flow, this.props.profile);

    return {
      connectorType: this.connectorType.asProfileConnectorType,
      apiVersion: this.props.apiVersion,
      connectorProfileName: this.props.profile.name,
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

  private tryAddNodeDependency(scope: IConstruct, resource?: IConstruct | string) {
    if (resource && typeof resource !== 'string') {
      scope.node.addDependency(resource);
    }
  }
}
