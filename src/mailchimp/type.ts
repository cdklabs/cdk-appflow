/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { ConnectorType } from '../core/connectors/connector-type';

/**
 * @internal
 */
export class MailchimpConnectorType extends ConnectorType {

  public static get instance(): ConnectorType {
    if (!MailchimpConnectorType.actualInstance) {
      MailchimpConnectorType.actualInstance = new MailchimpConnectorType();
    }
    return MailchimpConnectorType.actualInstance;
  }

  private static actualInstance: ConnectorType;

  constructor() {
    super('Mailchimp', true);
  }
}