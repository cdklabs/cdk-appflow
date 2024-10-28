/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { ConnectorType } from "../core/connectors/connector-type";

/**
 * @internal
 */
export class GoogleAnalytics4ConnectorType extends ConnectorType {
  public static get instance(): ConnectorType {
    if (!GoogleAnalytics4ConnectorType.actualInstance) {
      GoogleAnalytics4ConnectorType.actualInstance =
        new GoogleAnalytics4ConnectorType();
    }
    return GoogleAnalytics4ConnectorType.actualInstance;
  }

  private static actualInstance: ConnectorType;

  constructor() {
    super("GoogleAnalytics4", true);
  }
}
