/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnFlow } from "aws-cdk-lib/aws-appflow";
import { IConstruct } from "constructs";
import { HubSpotConnectorProfile } from "./profile";
import { HubSpotConnectorType } from "./type";
import { HubSpotApiVersion } from "./util";
import { ConnectorType } from "../core/connectors/connector-type";
import { IFlow } from "../core/flows";
import { ISource } from "../core/vertices";

/**
 * Properties of a Hubspot Source
 */
export interface HubSpotSourceProps {
  readonly profile: HubSpotConnectorProfile;
  readonly apiVersion: HubSpotApiVersion;
  readonly entity: string[];
}

/**
 * A class that represents a Hubspot Source
 */
export class HubSpotSource implements ISource {
  /**
   * The AppFlow type of the connector that this source is implemented for
   */
  public readonly connectorType: ConnectorType = HubSpotConnectorType.instance;

  constructor(private readonly props: HubSpotSourceProps) {}

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
        entityName: this.props.entity.join("/"),
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
