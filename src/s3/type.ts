/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { ConnectorType } from '../core/connectors/connector-type';

/**
 * @internal
 */
export class S3ConnectorType extends ConnectorType {

  public static get instance(): ConnectorType {
    if (!S3ConnectorType.actualInstance) {
      S3ConnectorType.actualInstance = new S3ConnectorType();
    }
    return S3ConnectorType.actualInstance;
  }

  private static actualInstance: ConnectorType;

  constructor() {
    super('S3', false);
  }
}