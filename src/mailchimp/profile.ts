/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { SecretValue } from "aws-cdk-lib";
import { CfnConnectorProfile } from "aws-cdk-lib/aws-appflow";
import { Construct } from "constructs";
import { MailchimpConnectorType } from "./type";
import { ConnectorAuthenticationType } from "../core/connectors/connector-authentication-type";
import {
  ConnectorProfileBase,
  ConnectorProfileProps,
} from "../core/connectors/connector-profile";

export interface MailchimpConnectorProfileProps extends ConnectorProfileProps {
  readonly apiKey: SecretValue;
  readonly instanceUrl: string;
}

/**
 * A class that represents a Mailchimp Connector Profile.
 *
 */
export class MailchimpConnectorProfile extends ConnectorProfileBase {
  public static fromConnectionProfileArn(
    scope: Construct,
    id: string,
    arn: string,
  ) {
    return this._fromConnectorProfileAttributes(scope, id, {
      arn,
    }) as MailchimpConnectorProfile;
  }

  public static fromConnectionProfileName(
    scope: Construct,
    id: string,
    name: string,
  ) {
    return this._fromConnectorProfileAttributes(scope, id, {
      name,
    }) as MailchimpConnectorProfile;
  }

  constructor(
    scope: Construct,
    id: string,
    props: MailchimpConnectorProfileProps,
  ) {
    super(scope, id, props, MailchimpConnectorType.instance);
  }

  protected buildConnectorProfileProperties(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfilePropertiesProperty {
    const properties = props as MailchimpConnectorProfileProps;
    return {
      customConnector: {
        profileProperties: {
          instanceUrl: properties.instanceUrl,
        },
      },
    };
  }

  protected buildConnectorProfileCredentials(
    props: ConnectorProfileProps,
  ): CfnConnectorProfile.ConnectorProfileCredentialsProperty {
    const properties = props as MailchimpConnectorProfileProps;

    return {
      customConnector: {
        authenticationType: ConnectorAuthenticationType.CUSTOM,
        custom: {
          credentialsMap: {
            // Safe usage
            api_key: properties.apiKey.unsafeUnwrap(),
          },
          customAuthenticationType: "api_key",
        },
      },
    };
  }
}
