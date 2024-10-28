/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnFlow } from "aws-cdk-lib/aws-appflow";
import { IConstruct } from "constructs";
import { GoogleBigQueryConnectorProfile } from "./profile";
import { GoogleBigQueryConnectorType } from "./type";
import { ConnectorType } from "../core/connectors/connector-type";
import { IFlow } from "../core/flows";
import { ISource } from "../core/vertices";

export interface GoogleBigQueryObject {
  readonly project: string;
  readonly dataset: string;
  readonly table: string;
}

/**
 * Properties of a Google BigQuery Source
 */
export interface GoogleBigQuerySourceProps {
  readonly profile: GoogleBigQueryConnectorProfile;
  readonly apiVersion: string;
  readonly object: GoogleBigQueryObject;
}

/**
 * A class that represents a Google BigQuery Source
 */
export class GoogleBigQuerySource implements ISource {
  /**
   * The AppFlow type of the connector that this source is implemented for
   */
  public readonly connectorType: ConnectorType =
    GoogleBigQueryConnectorType.instance;

  constructor(private readonly props: GoogleBigQuerySourceProps) {}

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
        entityName: `table/${this.props.object.project}/${this.props.object.dataset}/${this.props.object.table}`,
      },
    };
  }

  private tryAddNodeDependency(
    scope: IConstruct,
    resource?: IConstruct | string,
  ): void {
    if (resource && typeof resource !== "string") {
      scope.node.addDependency(resource);
    }
  }
}
