/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { ConnectorType } from '../core/connectors/connector-type';

/**
 * @internal
 */
export class SnowflakeConnectorType extends ConnectorType {

  public static get instance(): ConnectorType {
    if (!SnowflakeConnectorType.actualInstance) {
      SnowflakeConnectorType.actualInstance = new SnowflakeConnectorType();
    }
    return SnowflakeConnectorType.actualInstance;
  }

  private static actualInstance: ConnectorType;

  constructor() {
    super('Snowflake', false);
  }
}