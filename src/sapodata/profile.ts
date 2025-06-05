/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { SecretValue } from "aws-cdk-lib";
import { CfnConnectorProfile } from "aws-cdk-lib/aws-appflow";
import { Construct } from "constructs";
import { SAPOdataConnectorType } from "./type";
import {
  ConnectorProfileBase,
  ConnectorProfileProps,
} from "../core/connectors/connector-profile";

export interface SAPOdataConnectorProfileProps extends ConnectorProfileProps {
  readonly basicAuth?: SAPOdataBasicAuthSettings;
  readonly oAuth?: SAPOdataOAuthSettings;
  readonly applicationHostUrl: string;
  readonly applicationServicePath: string;
  readonly portNumber?: number;
  // TODO: make sure if this is only number
  readonly clientNumber: string;
  readonly logonLanguage: string;
}

export interface SAPOdataBasicAuthSettings {
  readonly username: string;
  readonly password: SecretValue;
}

export interface SAPOdataOAuthEndpoints {
  readonly token: string;
}

export interface SAPOdataOAuthRefreshTokenGrantFlow {
  readonly refreshToken?: SecretValue;
  readonly clientId: SecretValue;
  readonly clientSecret: SecretValue;
}

export interface SAPOdataOAuthFlows {
  readonly refreshTokenGrant: SAPOdataOAuthRefreshTokenGrantFlow;
}

export interface SAPOdataOAuthSettings {
  readonly accessToken?: SecretValue;

  readonly flow?: SAPOdataOAuthFlows;

  readonly endpoints?: SAPOdataOAuthEndpoints;
}

export class SAPOdataConnectorProfile extends ConnectorProfileBase {
  public static fromConnectionProfileArn(
    scope: Construct,
    id: string,
    arn: string,
  ) {
    return this._fromConnectorProfileAttributes(scope, id, {
      arn,
    }) as SAPOdataConnectorProfile;
  }

  public static fromConnectionProfileName(
    scope: Construct,
    id: string,
    name: string,
  ) {
    return this._fromConnectorProfileAttributes(scope, id, {
      name,
    }) as SAPOdataConnectorProfile;
  }

  constructor(
    scope: Construct,
    id: string,
    props: SAPOdataConnectorProfileProps,
  ) {
    super(scope, id, props, SAPOdataConnectorType.instance);
  }

  protected buildConnectorProfileCredentials(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfileCredentialsProperty {
    const properties = props as SAPOdataConnectorProfileProps;

    let sapOdata: { [key: string]: any } = {};

    if (properties.basicAuth) {
      sapOdata.basicAuthCredentials = {
        username: properties.basicAuth.username,
        password: properties.basicAuth.password.unsafeUnwrap(),
      };
    } else if (properties.oAuth) {
      sapOdata.oAuthCredentials = {
        // Safe usage
        accessToken: properties.oAuth.accessToken?.unsafeUnwrap(),
        // Safe usage
        refreshToken:
          properties.oAuth.flow?.refreshTokenGrant.refreshToken?.unsafeUnwrap(),
        // Safe usage
        clientId:
          properties.oAuth.flow?.refreshTokenGrant.clientId?.unsafeUnwrap(),
        // Safe usage
        clientSecret:
          properties.oAuth.flow?.refreshTokenGrant.clientSecret?.unsafeUnwrap(),
      };
    }

    return {
      sapoData: sapOdata,
    };
  }

  protected buildConnectorProfileProperties(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfilePropertiesProperty {
    const properties = props as SAPOdataConnectorProfileProps;
    return {
      sapoData: {
        applicationHostUrl: properties.applicationHostUrl,
        applicationServicePath: properties.applicationServicePath,
        portNumber: properties.portNumber,
        clientNumber: properties.clientNumber,
        logonLanguage: properties.logonLanguage,
      },
    };
  }
}
