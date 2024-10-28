/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnFlow } from "aws-cdk-lib/aws-appflow";
import { IConstruct } from "constructs";
import { ServiceNowConnectorProfile } from "./profile";
import { ServiceNowConnectorType } from "./type";
import { ConnectorType } from "../core/connectors/connector-type";
import { IFlow } from "../core/flows";
import { ISource } from "../core/vertices/source";

export interface ServiceNowSourceProps {
  readonly profile: ServiceNowConnectorProfile;
  readonly object: string;
}

export class ServiceNowSource implements ISource {
  public readonly connectorType: ConnectorType =
    ServiceNowConnectorType.instance;

  constructor(private readonly props: ServiceNowSourceProps) {}

  bind(flow: IFlow): CfnFlow.SourceFlowConfigProperty {
    this.tryAddNodeDependency(flow, this.props.profile);

    return {
      connectorType: this.connectorType.asProfileConnectorType,
      connectorProfileName: this.props.profile.name,
      sourceConnectorProperties: this.buildSourceConnectorProperties(),
    };
  }

  private buildSourceConnectorProperties(): CfnFlow.SourceConnectorPropertiesProperty {
    return {
      serviceNow: {
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
