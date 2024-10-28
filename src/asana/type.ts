/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { ConnectorType } from "../core/connectors/connector-type";

/**
 * @internal
 */
export class AsanaConnectorType extends ConnectorType {
  public static get instance(): ConnectorType {
    if (!AsanaConnectorType.actualInstance) {
      AsanaConnectorType.actualInstance = new AsanaConnectorType();
    }
    return AsanaConnectorType.actualInstance;
  }

  private static actualInstance: ConnectorType;

  constructor() {
    super("Asana", true);
  }
}
