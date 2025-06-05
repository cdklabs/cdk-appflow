/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { SecretValue } from "aws-cdk-lib";
import { CfnConnectorProfile } from "aws-cdk-lib/aws-appflow";
import { Construct } from "constructs";
import { ServiceNowConnectorType } from "./type";
import {
  ConnectorProfileBase,
  ConnectorProfileProps,
} from "../core/connectors/connector-profile";

export interface ServiceNowConnectorProfileProps extends ConnectorProfileProps {
  readonly basicAuth: ServiceNowBasicSettings;
  readonly instanceUrl: string;
}

export interface ServiceNowBasicSettings {
  readonly username: string;
  readonly password: SecretValue;
}

export class ServiceNowConnectorProfile extends ConnectorProfileBase {
  public static fromConnectionProfileArn(
    scope: Construct,
    id: string,
    arn: string,
  ) {
    return this._fromConnectorProfileAttributes(scope, id, {
      arn,
    }) as ServiceNowConnectorProfile;
  }

  public static fromConnectionProfileName(
    scope: Construct,
    id: string,
    name: string,
  ) {
    return this._fromConnectorProfileAttributes(scope, id, {
      name,
    }) as ServiceNowConnectorProfile;
  }

  constructor(
    scope: Construct,
    id: string,
    props: ServiceNowConnectorProfileProps,
  ) {
    super(scope, id, props, ServiceNowConnectorType.instance);
  }

  protected buildConnectorProfileCredentials(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfileCredentialsProperty {
    const properties = props as ServiceNowConnectorProfileProps;
    return {
      serviceNow: {
        username: properties.basicAuth?.username,
        // Safe usage
        password: properties.basicAuth?.password.unsafeUnwrap(),
      },
    };
  }

  protected buildConnectorProfileProperties(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfilePropertiesProperty {
    const properties = props as ServiceNowConnectorProfileProps;
    return {
      serviceNow: {
        instanceUrl: properties.instanceUrl,
      },
    };
  }
}
