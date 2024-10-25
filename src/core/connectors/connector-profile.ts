/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Arn, ArnFormat, IResource, Resource, Stack } from "aws-cdk-lib";
import { CfnConnectorProfile } from "aws-cdk-lib/aws-appflow";
import { IKey } from "aws-cdk-lib/aws-kms";
import { ISecret, Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct, IConstruct } from "constructs";
import { ConnectionMode } from "./connection-mode";
import { ConnectorType } from "./connector-type";
import { AppFlowPermissionsManager } from "../appflow-permissions-manager";

export interface IConnectorProfile extends IResource {
  readonly name: string;
  readonly arn: string;
  readonly credentials?: ISecret;
}

export interface ConnectorProfileProps {
  readonly name?: string;
  /**
   * TODO: think if this should be here as not all connector profiles have that
   */
  // readonly mode?: ConnectionMode;
  readonly key?: IKey;
}

export abstract class ConnectorProfileBase
  extends Resource
  implements IConnectorProfile
{
  /**
   * @internal
   * @experimental
   */
  protected static _fromConnectorProfileAttributes(
    scope: Construct,
    id: string,
    attrs: {
      name?: string;
      arn?: string;
    },
  ): IConnectorProfile {
    if (attrs.name === undefined && attrs.arn === undefined) {
      throw new Error("Either 'name' or 'arn' needs to be defined");
    }

    const { name, arn } = attrs;

    class Import extends Resource implements IConnectorProfile {
      public readonly arn: string;
      public readonly credentials?: ISecret = undefined;
      public readonly name: string;
      constructor() {
        super(scope, id);
        this.arn = arn
          ? arn
          : Stack.of(this).formatArn({
              service: "appflow",
              resource: "connectorprofile",
              resourceName: name,
              arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
            });
        this.name = name
          ? name
          : Arn.split(arn!, ArnFormat.SLASH_RESOURCE_NAME).resourceName!;
      }
    }

    return new Import();
  }

  public readonly arn: string;
  public readonly credentials?: ISecret;
  public readonly name: string;

  constructor(
    scope: Construct,
    id: string,
    props: ConnectorProfileProps,
    connectorType: ConnectorType,
  ) {
    super(scope, id);

    this.name = props.name ?? id;
    this.tryAddNodeDependency(this, props.key);
    AppFlowPermissionsManager.instance().grantKeyEncryptDecrypt(props.key);

    const resource = new CfnConnectorProfile(this, id, {
      connectorProfileName: this.name,
      connectorLabel: connectorType.asProfileConnectorLabel,
      connectorType: connectorType.asProfileConnectorType,
      connectionMode: ConnectionMode.PUBLIC,
      kmsArn: props.key && props.key.keyArn,
      connectorProfileConfig: {
        connectorProfileCredentials:
          this.buildConnectorProfileCredentials(props),
        connectorProfileProperties: this.buildConnectorProfileProperties(props),
      },
    });

    this.arn = resource.attrConnectorProfileArn;
    this.credentials = Secret.fromSecretCompleteArn(
      scope,
      `${id}Credentials`,
      resource.attrCredentialsArn,
    );
  }

  protected abstract buildConnectorProfileCredentials(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfileCredentialsProperty;
  protected abstract buildConnectorProfileProperties(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfilePropertiesProperty;

  protected tryAddNodeDependency(
    scope: IConstruct,
    resource?: IConstruct | string,
  ) {
    if (resource && typeof resource !== "string") {
      scope.node.addDependency(resource);
    }
  }
}
