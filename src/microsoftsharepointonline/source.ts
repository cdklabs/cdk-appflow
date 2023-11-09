/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Fn } from 'aws-cdk-lib';
import { CfnFlow } from 'aws-cdk-lib/aws-appflow';
import { IConstruct } from 'constructs';
import { MicrosoftSharepointOnlineConnectorProfile } from './profile';
import { MicrosoftSharepointOnlineConnectorType } from './type';
import { ConnectorType } from '../core/connectors/connector-type';
import { IFlow } from '../core/flows';
import { ISource } from '../core/vertices';

/**
 * Represents a list of Microsoft Sharepoint Online site drives from which to retrieve the documents.
 */
export interface MicrosoftSharepointOnlineObject {
  /**
   * The Microsoft Sharepoint Online site from which the documents are to be retrieved.
   *
   * Note: requires full name starting with 'sites/'
   */
  readonly site: string;

  /**
   * An array of Microsoft Sharepoint Online site drives from which the documents are to be retrieved.
   *
   * Note: each drive requires full name starting with 'drives/'
   * @deprecated. This property is deprecated and will be removed in a future release. Use {@link entities} instead
   */
  readonly drives?: string[];

  /**
   * An array of Microsoft Sharepoint Online site entities from which the documents are to be retrieved.
   *
   * Note: each entity requires full name starting with 'drives/' followed by driveID and optional '/items/' followed by itemID
   * @example: 'drives/${driveID}'
   * @example: 'drives/${driveID}/items/${itemID}'
   */
  readonly entities?: string[];
}

/**
 * Properties of a Microsoft Sharepoint Online Source
 */
export interface MicrosoftSharepointOnlineSourceProps {
  readonly profile: MicrosoftSharepointOnlineConnectorProfile;
  readonly apiVersion: string;
  readonly object: MicrosoftSharepointOnlineObject;
}

/**
 * A class that represents a Microsoft Sharepoint Online Source
 */
export class MicrosoftSharepointOnlineSource implements ISource {

  /**
   * The AppFlow type of the connector that this source is implemented for
   */
  public readonly connectorType: ConnectorType = MicrosoftSharepointOnlineConnectorType.instance;

  constructor(private readonly props: MicrosoftSharepointOnlineSourceProps) { }

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

    if (this.props.object.entities && this.props.object.drives) {
      throw new Error('Only one of the properties entities or drives should be specified');
    }

    const entities = this.props.object.entities ?? this.props.object.drives ?? [];
    if (entities.length < 1) {
      throw new Error('At least one entity must be specified');
    }

    return {
      customConnector: {
        entityName: this.props.object.site,
        customProperties: {
          subEntities: `["${Fn.join('","', entities)}"]`,
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
