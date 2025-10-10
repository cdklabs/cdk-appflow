/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { ConnectorType } from "../core/connectors/connector-type";

/**
 * @internal
 */
export class RedshiftConnectorType extends ConnectorType {
  public static get instance(): ConnectorType {
    if (!RedshiftConnectorType.actualInstance) {
      RedshiftConnectorType.actualInstance = new RedshiftConnectorType();
    }
    return RedshiftConnectorType.actualInstance;
  }

  private static actualInstance: ConnectorType;

  constructor() {
    super("Redshift", false);
  }
}
