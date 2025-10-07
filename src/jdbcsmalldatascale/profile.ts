/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { SecretValue } from "aws-cdk-lib";
import { CfnConnectorProfile } from "aws-cdk-lib/aws-appflow";
import { Construct } from "constructs";
import { JdbcDriver } from "./driver";
import { JdbcSmallDataScaleConnectorType } from "./type";
import { ConnectorAuthenticationType } from "../core";
import {
  ConnectorProfileBase,
  ConnectorProfileProps,
} from "../core/connectors/connector-profile";

/**
 * Properties for the JdbcSmallDataScaleConnectorProfile
 */
export interface JdbcSmallDataScaleConnectorProfileProps
  extends ConnectorProfileProps {
  /**
   * The auth settings for the profile
   */
  readonly basicAuth: JdbcSmallDataScaleBasicAuthSettings;

  /**
   * The hostname of the database to interact with
   */
  readonly hostname: string;

  /**
   * The database communication port
   */
  readonly port: number;

  /**
   * The name of the database
   */
  readonly database: string;

  /**
   * The driver for the database. Effectively specifies the type of database.
   */
  readonly driver: JdbcDriver;
}

/**
 * Basic authentication settings for the JdbcSmallDataScaleConnectorProfile
 */
export interface JdbcSmallDataScaleBasicAuthSettings {
  /**
   * The username of the identity used for interacting with the database
   */
  readonly username: string;

  /**
   * The password of the identity used for interacting with the database
   */
  readonly password: SecretValue;
}

/**
 * The connector profile for the JDBC connector
 */
export class JdbcSmallDataScaleConnectorProfile extends ConnectorProfileBase {
  /**
   * Imports an existing JdbcSmallDataScaleConnectorProfile
   * @param scope the scope for the connector profile
   * @param id the connector profile's ID
   * @param arn the ARN for the existing connector profile
   * @returns An instance of the JdbcSmallDataScaleConnectorProfile
   */
  public static fromConnectionProfileArn(
    scope: Construct,
    id: string,
    arn: string,
  ) {
    return this._fromConnectorProfileAttributes(scope, id, {
      arn,
    }) as JdbcSmallDataScaleConnectorProfile;
  }

  /**
   * Imports an existing JdbcSmallDataScaleConnectorProfile
   * @param scope the scope for the connector profile
   * @param id the connector profile's ID
   * @param name the name for the existing connector profile
   * @returns An instance of the JdbcSmallDataScaleConnectorProfile
   */
  public static fromConnectionProfileName(
    scope: Construct,
    id: string,
    name: string,
  ) {
    return this._fromConnectorProfileAttributes(scope, id, {
      name,
    }) as JdbcSmallDataScaleConnectorProfile;
  }

  /**
   * Creates a new instance of the JdbcSmallDataScaleConnectorProfile
   * @param scope the Construct scope for this connector profile
   * @param id the id of this connector profile
   * @param props properties to use when instantiating this connector profile
   */
  constructor(
    scope: Construct,
    id: string,
    props: JdbcSmallDataScaleConnectorProfileProps,
  ) {
    super(scope, id, props, JdbcSmallDataScaleConnectorType.instance);
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
    const properties = props as JdbcSmallDataScaleConnectorProfileProps;
    return {
      customConnector: {
        authenticationType: ConnectorAuthenticationType.CUSTOM,
        custom: {
          credentialsMap: {
            username: properties.basicAuth.username,
            // Safe usage
            password: properties.basicAuth.password.unsafeUnwrap(),
            driver: properties.driver,
            hostname: properties.hostname,
            port: `${properties.port}`,
            database: properties.database,
          },
          customAuthenticationType: "CUSTOM",
        },
      },
    };
  }
}
