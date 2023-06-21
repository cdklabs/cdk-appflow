/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { ConnectorType } from '../core/connectors/connector-type';

/**
 * @internal
 */
export class SlackConnectorType extends ConnectorType {

  public static get instance(): ConnectorType {
    if (!SlackConnectorType.actualInstance) {
      SlackConnectorType.actualInstance = new SlackConnectorType();
    }
    return SlackConnectorType.actualInstance;
  }

  private static actualInstance: ConnectorType;

  constructor() {
    super('Slack', false);
  }
}