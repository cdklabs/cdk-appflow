/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnFlow } from "aws-cdk-lib/aws-appflow";
import { IConstruct } from "constructs";
import { MailchimpConnectorProfile } from "./profile";
import { MailchimpConnectorType } from "./type";
import { ConnectorType } from "../core/connectors/connector-type";
import { IFlow } from "../core/flows";
import { ISource } from "../core/vertices";

export interface MailchimpSourceProps {
  readonly profile: MailchimpConnectorProfile;
  readonly apiVersion: string;
  readonly object: string;
}

/**
 * A class that represents a Mailchimp v3 Source
 */
export class MailchimpSource implements ISource {
  /**
   * The AppFlow type of the connector that this source is implemented for
   */
  public readonly connectorType: ConnectorType =
    MailchimpConnectorType.instance;

  constructor(private readonly props: MailchimpSourceProps) {}

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

  private tryAddNodeDependency(
    scope: IConstruct,
    resource?: IConstruct | string,
  ) {
    if (resource && typeof resource !== "string") {
      scope.node.addDependency(resource);
    }
  }
}
