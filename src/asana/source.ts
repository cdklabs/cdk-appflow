/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnFlow } from "aws-cdk-lib/aws-appflow";
import { IConstruct } from "constructs";
import { AsanaConnectorProfile } from "./profile";
import { AsanaConnectorType } from "./type";
import { ConnectorType } from "../core/connectors/connector-type";
import { IFlow } from "../core/flows";
import { ISource } from "../core/vertices";

export interface AsanaSourceProps {
  readonly profile: AsanaConnectorProfile;
  readonly object: string;
  readonly apiVersion?: string;
}

/**
 * A class that represents a Asana v3 Source
 */
export class AsanaSource implements ISource {
  private static readonly apiVersion: string = "1.0";

  /**
   * The AppFlow type of the connector that this source is implemented for
   */
  public readonly connectorType: ConnectorType = AsanaConnectorType.instance;

  constructor(private readonly props: AsanaSourceProps) {}

  bind(flow: IFlow): CfnFlow.SourceFlowConfigProperty {
    this.tryAddNodeDependency(flow, this.props.profile);

    return {
      apiVersion: this.props.apiVersion ?? AsanaSource.apiVersion,
      connectorType: this.connectorType.asProfileConnectorType,
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

  private tryAddNodeDependency(
    scope: IConstruct,
    resource?: IConstruct | string,
  ) {
    if (resource && typeof resource !== "string") {
      scope.node.addDependency(resource);
    }
  }
}
