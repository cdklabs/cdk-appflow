/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { ConnectorType } from "../core/connectors/connector-type";

/**
 * @internal
 */
export class SalesforceMarketingCloudConnectorType extends ConnectorType {
  public static get instance(): ConnectorType {
    if (!SalesforceMarketingCloudConnectorType.actualInstance) {
      SalesforceMarketingCloudConnectorType.actualInstance =
        new SalesforceMarketingCloudConnectorType();
    }
    return SalesforceMarketingCloudConnectorType.actualInstance;
  }

  private static actualInstance: ConnectorType;

  constructor() {
    super("SalesforceMarketingCloud", true);
  }
}
