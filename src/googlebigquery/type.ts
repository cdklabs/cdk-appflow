/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { ConnectorType } from '../core/connectors/connector-type';

/**
 * @internal
 */
export class GoogleBigQueryConnectorType extends ConnectorType {

  public static get instance(): ConnectorType {
    if (!GoogleBigQueryConnectorType.actualInstance) {
      GoogleBigQueryConnectorType.actualInstance = new GoogleBigQueryConnectorType();
    }
    return GoogleBigQueryConnectorType.actualInstance;
  }

  private static actualInstance: ConnectorType;

  constructor() {
    super('GoogleBigQuery', true);
  }
}