/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { ConnectorType } from "../core/connectors/connector-type";

/**
 * @internal
 */
export class HubSpotConnectorType extends ConnectorType {
  public static get instance(): ConnectorType {
    if (!HubSpotConnectorType.actualInstance) {
      HubSpotConnectorType.actualInstance = new HubSpotConnectorType();
    }
    return HubSpotConnectorType.actualInstance;
  }

  private static actualInstance: ConnectorType;

  constructor() {
    super("HubSpot", true);
  }
}
