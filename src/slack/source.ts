/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnFlow } from "aws-cdk-lib/aws-appflow";
import { IConstruct } from "constructs";
import { SlackConnectorProfile } from "./profile";
import { SlackConnectorType } from "./type";
import { ConnectorType } from "../core/connectors/connector-type";
import { IFlow } from "../core/flows";
import { ISource } from "../core/vertices/source";

export interface SlackSourceProps {
  readonly profile: SlackConnectorProfile;
  readonly object: string;
  readonly apiVersion?: string;
}

export class SlackSource implements ISource {
  public readonly connectorType: ConnectorType = SlackConnectorType.instance;

  constructor(private readonly props: SlackSourceProps) {}

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
      slack: {
        object: this.props.object,
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
