/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { ConnectorType } from "../core/connectors/connector-type";

/**
 * @internal
 */
export class ServiceNowConnectorType extends ConnectorType {
  public static get instance(): ConnectorType {
    if (!ServiceNowConnectorType.actualInstance) {
      ServiceNowConnectorType.actualInstance = new ServiceNowConnectorType();
    }
    return ServiceNowConnectorType.actualInstance;
  }

  private static actualInstance: ConnectorType;

  constructor() {
    super("ServiceNow", false);
  }
}
