/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { ConnectorType } from '../core/connectors/connector-type';

/**
 * @internal
 */
export class EventBridgeConnectorType extends ConnectorType {

  public static get instance(): ConnectorType {
    if (!EventBridgeConnectorType.actualInstance) {
      EventBridgeConnectorType.actualInstance = new EventBridgeConnectorType();
    }
    return EventBridgeConnectorType.actualInstance;
  }

  private static actualInstance: ConnectorType;

  constructor() {
    super('EventBridge', false);
  }

  public get asProfileConnectorType(): string {
    return this.name;
  }
}