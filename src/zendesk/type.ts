/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { ConnectorType } from "../core/connectors/connector-type";

/**
 * @internal
 */
export class ZendeskConnectorType extends ConnectorType {
  public static get instance(): ConnectorType {
    if (!ZendeskConnectorType.actualInstance) {
      ZendeskConnectorType.actualInstance = new ZendeskConnectorType();
    }
    return ZendeskConnectorType.actualInstance;
  }

  private static actualInstance: ConnectorType;

  constructor() {
    super("Zendesk", false);
  }
}
