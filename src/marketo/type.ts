/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { ConnectorType } from '../core/connectors/connector-type';

/**
 * @internal
 */
export class MarketoConnectorType extends ConnectorType {

  public static get instance(): ConnectorType {
    if (!MarketoConnectorType.actualInstance) {
      MarketoConnectorType.actualInstance = new MarketoConnectorType();
    }
    return MarketoConnectorType.actualInstance;
  }

  private static actualInstance: ConnectorType;

  constructor() {
    super('Marketo', false);
  }
}