/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { ConnectorType } from '../core/connectors/connector-type';

/**
 * @internal
 */
export class MicrosoftDynamics365ConnectorType extends ConnectorType {

  public static get instance(): ConnectorType {
    if (!MicrosoftDynamics365ConnectorType.actualInstance) {
      MicrosoftDynamics365ConnectorType.actualInstance = new MicrosoftDynamics365ConnectorType();
    }
    return MicrosoftDynamics365ConnectorType.actualInstance;
  }

  private static actualInstance: ConnectorType;

  constructor() {
    super('MicrosoftDynamics365', true);
  }
}