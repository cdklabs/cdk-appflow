/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { ConnectorType } from '../core/connectors/connector-type';

/**
 * @internal
 */
export class SalesforceConnectorType extends ConnectorType {

  public static get instance(): ConnectorType {
    if (!SalesforceConnectorType.actualInstance) {
      SalesforceConnectorType.actualInstance = new SalesforceConnectorType();
    }
    return SalesforceConnectorType.actualInstance;
  }

  private static actualInstance: ConnectorType;

  constructor() {
    super('Salesforce', false);
  }
}