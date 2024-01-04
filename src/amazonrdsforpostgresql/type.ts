/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { ConnectorType } from '../core/connectors/connector-type';

/**
 * @internal
 */
export class AmazonRdsForPostgreSqlConnectorType extends ConnectorType {

  public static get instance(): ConnectorType {
    if (!AmazonRdsForPostgreSqlConnectorType.actualInstance) {
      AmazonRdsForPostgreSqlConnectorType.actualInstance = new AmazonRdsForPostgreSqlConnectorType();
    }
    return AmazonRdsForPostgreSqlConnectorType.actualInstance;
  }

  private static actualInstance: ConnectorType;

  constructor() {
    super('AmazonRDSPostgreSQL', true);
  }
}