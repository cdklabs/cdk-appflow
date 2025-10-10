/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { SecretValue } from "aws-cdk-lib";
import { CfnConnectorProfile } from "aws-cdk-lib/aws-appflow";
import { Construct } from "constructs";
import { MarketoConnectorType } from "./type";
import {
  ConnectorProfileBase,
  ConnectorProfileProps,
} from "../core/connectors/connector-profile";

export interface MarketoConnectorProfileProps extends ConnectorProfileProps {
  readonly oAuth: MarketoOAuthSettings;
  readonly instanceUrl: string;
}

export interface MarketoOAuthClientCredentialsFlow {
  readonly clientId: SecretValue;
  readonly clientSecret: SecretValue;
}

export interface MarketoOAuthFlow {
  readonly clientCredentials: MarketoOAuthClientCredentialsFlow;
}

export interface MarketoOAuthSettings {
  readonly accessToken?: SecretValue;
  readonly flow: MarketoOAuthFlow;
}

export class MarketoConnectorProfile extends ConnectorProfileBase {
  public static fromConnectionProfileArn(
    scope: Construct,
    id: string,
    arn: string,
  ) {
    return this._fromConnectorProfileAttributes(scope, id, {
      arn,
    }) as MarketoConnectorProfile;
  }

  public static fromConnectionProfileName(
    scope: Construct,
    id: string,
    name: string,
  ) {
    return this._fromConnectorProfileAttributes(scope, id, {
      name,
    }) as MarketoConnectorProfile;
  }

  constructor(
    scope: Construct,
    id: string,
    props: MarketoConnectorProfileProps,
  ) {
    super(scope, id, props, MarketoConnectorType.instance);
  }

  protected buildConnectorProfileProperties(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfilePropertiesProperty {
    const properties = props as MarketoConnectorProfileProps;
    return {
      marketo: {
        instanceUrl: properties.instanceUrl,
      },
    };
  }

  protected buildConnectorProfileCredentials(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfileCredentialsProperty {
    const properties = props as MarketoConnectorProfileProps;
    return {
      marketo: {
        // Safe usage
        accessToken: properties.oAuth.accessToken?.unsafeUnwrap(),
        clientId:
          // Safe usage
          properties.oAuth.flow.clientCredentials.clientId.unsafeUnwrap(),
        clientSecret:
          // Safe usage
          properties.oAuth.flow.clientCredentials.clientSecret.unsafeUnwrap(),
      },
    };
  }
}
