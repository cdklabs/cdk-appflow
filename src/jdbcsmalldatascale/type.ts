/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { ConnectorType } from '../core/connectors/connector-type';

/**
 * @internal
 */
export class JdbcSmallDataScaleConnectorType extends ConnectorType {

  public static get instance(): ConnectorType {
    if (!JdbcSmallDataScaleConnectorType.actualInstance) {
      JdbcSmallDataScaleConnectorType.actualInstance = new JdbcSmallDataScaleConnectorType();
    }
    return JdbcSmallDataScaleConnectorType.actualInstance;
  }

  private static actualInstance: ConnectorType;

  constructor() {
    super('JDBCsmall', true);
  }
}