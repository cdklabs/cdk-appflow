/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { ConnectorType } from '../core/connectors/connector-type';

/**
 * @internal
 */
export class GoogleAdsConnectorType extends ConnectorType {
  /**
     * Singleton
     */
  public static get instance(): ConnectorType {
    if (!GoogleAdsConnectorType.actualInstance) {
      GoogleAdsConnectorType.actualInstance = new GoogleAdsConnectorType();
    }
    return GoogleAdsConnectorType.actualInstance;
  }

  private static actualInstance: ConnectorType;

  constructor() {
    super('GoogleAds', true);
  }
}