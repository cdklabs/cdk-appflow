/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { SecretValue } from "aws-cdk-lib";
import { CfnConnectorProfile } from "aws-cdk-lib/aws-appflow";
import { Construct } from "constructs";
import { AsanaConnectorType } from "./type";
import { ConnectorAuthenticationType } from "../core/connectors/connector-authentication-type";
import {
  ConnectorProfileBase,
  ConnectorProfileProps,
} from "../core/connectors/connector-profile";

export interface AsanaConnectorProfileProps extends ConnectorProfileProps {
  readonly patToken: SecretValue;
}

/**
 * A class that represents a Asana Connector Profile.
 *
 */
export class AsanaConnectorProfile extends ConnectorProfileBase {
  public static fromConnectionProfileArn(
    scope: Construct,
    id: string,
    arn: string,
  ) {
    return this._fromConnectorProfileAttributes(scope, id, {
      arn,
    }) as AsanaConnectorProfile;
  }

  public static fromConnectionProfileName(
    scope: Construct,
    id: string,
    name: string,
  ) {
    return this._fromConnectorProfileAttributes(scope, id, {
      name,
    }) as AsanaConnectorProfile;
  }

  constructor(scope: Construct, id: string, props: AsanaConnectorProfileProps) {
    super(scope, id, props, AsanaConnectorType.instance);
  }

  protected buildConnectorProfileProperties(
    _props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfilePropertiesProperty {
    return {
      customConnector: {
        profileProperties: {},
      },
    };
  }

  protected buildConnectorProfileCredentials(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfileCredentialsProperty {
    const properties = props as AsanaConnectorProfileProps;

    return {
      customConnector: {
        authenticationType: ConnectorAuthenticationType.CUSTOM,
        custom: {
          credentialsMap: {
            patToken: properties.patToken.unsafeUnwrap(),
          },
          customAuthenticationType: "PAT",
        },
      },
    };
  }
}
