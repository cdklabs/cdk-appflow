/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { ConnectorType } from '../core/connectors/connector-type';

/**
 * @internal
 */
export class MicrosoftSharepointOnlineConnectorType extends ConnectorType {

  public static get instance(): ConnectorType {
    if (!MicrosoftSharepointOnlineConnectorType.actualInstance) {
      MicrosoftSharepointOnlineConnectorType.actualInstance = new MicrosoftSharepointOnlineConnectorType();
    }
    return MicrosoftSharepointOnlineConnectorType.actualInstance;
  }

  private static actualInstance: ConnectorType;

  constructor() {
    super('MicrosoftSharePointOnline', true);
  }
}