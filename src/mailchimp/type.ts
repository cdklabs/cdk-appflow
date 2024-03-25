/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { ConnectorType } from '../core/connectors/connector-type';

/**
 * @internal
 */
export class MailChimpConnectorType extends ConnectorType {

  public static get instance(): ConnectorType {
    if (!MailChimpConnectorType.actualInstance) {
      MailChimpConnectorType.actualInstance = new MailChimpConnectorType();
    }
    return MailChimpConnectorType.actualInstance;
  }

  private static actualInstance: ConnectorType;

  constructor() {
    super('Mailchimp', true);
  }
}