/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { ConnectorType } from '../core/connectors/connector-type';

/**
 * @internal
 */
export class SAPOdataConnectorType extends ConnectorType {

  public static get instance(): ConnectorType {
    if (!SAPOdataConnectorType.actualInstance) {
      SAPOdataConnectorType.actualInstance = new SAPOdataConnectorType();
    }
    return SAPOdataConnectorType.actualInstance;
  }

  private static actualInstance: ConnectorType;

  constructor() {
    super('SAPOData', false);
  }

  public get asTaskConnectorOperatorOrigin(): string {
    return 'sapoData';
  }

  public get asProfileConnectorType(): string {
    return this.name;
  }
}