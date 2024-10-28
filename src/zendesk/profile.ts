/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { SecretValue } from "aws-cdk-lib";
import { CfnConnectorProfile } from "aws-cdk-lib/aws-appflow";
import { Construct } from "constructs";
import { ZendeskConnectorType } from "./type";
import {
  ConnectorProfileBase,
  ConnectorProfileProps,
} from "../core/connectors/connector-profile";

export interface ZendeskConnectorProfileProps extends ConnectorProfileProps {
  readonly oAuth: ZendeskOAuthSettings;
  readonly instanceUrl: string;
}

export interface ZendeskOAuthSettings {
  readonly accessToken?: SecretValue;
  readonly clientId: SecretValue;
  readonly clientSecret: SecretValue;
}

export class ZendeskConnectorProfile extends ConnectorProfileBase {
  public static fromConnectionProfileArn(
    scope: Construct,
    id: string,
    arn: string,
  ) {
    return this._fromConnectorProfileAttributes(scope, id, {
      arn,
    }) as ZendeskConnectorProfile;
  }

  public static fromConnectionProfileName(
    scope: Construct,
    id: string,
    name: string,
  ) {
    return this._fromConnectorProfileAttributes(scope, id, {
      name,
    }) as ZendeskConnectorProfile;
  }

  constructor(
    scope: Construct,
    id: string,
    props: ZendeskConnectorProfileProps,
  ) {
    super(scope, id, props, ZendeskConnectorType.instance);
  }

  protected buildConnectorProfileProperties(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfilePropertiesProperty {
    const properties = props as ZendeskConnectorProfileProps;
    return {
      zendesk: {
        instanceUrl: properties.instanceUrl,
      },
    };
  }

  protected buildConnectorProfileCredentials(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfileCredentialsProperty {
    const properties = props as ZendeskConnectorProfileProps;
    return {
      zendesk: {
        accessToken: properties.oAuth.accessToken?.unsafeUnwrap(),
        clientId: properties.oAuth.clientId.unsafeUnwrap(),
        clientSecret: properties.oAuth.clientSecret.unsafeUnwrap(),
      },
    };
  }
}
