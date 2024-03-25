/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { SecretValue, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';

import { MailChimpConnectorProfile } from '../../src';

describe('MailChimpConnectorProfileProps', () => {

  test('API Key profile with credentials exists in the stack', () => {
    const stack = new Stack(undefined, 'TestStack', { env: { account: '12345678', region: 'dummy' } });

    const clientSecret = new Secret(stack, 'TestSecret');
    // Instance URL
    // 'https://region-id.api.mailchimp.com',
    // replace the region-id with your mailchimp region ID ex: us16

    new MailChimpConnectorProfile(stack, 'TestProfile', {
        apiKey: clientSecret.secretValueFromJson('apiKey').toString(),
        instanceUrl: clientSecret.secretValueFromJson('instanceUrl').toString(),
    });

    Template.fromStack(stack).hasResourceProperties('AWS::AppFlow::ConnectorProfile', {
      ConnectionMode: 'Public',
      ConnectorProfileName: 'TestProfile',
      ConnectorType: 'MailChimp',
      ConnectorProfileConfig: {
        ConnectorProfileCredentials: {
            MailChimp: {
                AccessToken: 'accessToken',
                ClientId: 'clientId',
                ClientSecret: 'clientSecret',
            },
        },
        ConnectorProfileProperties: {
            MailChimp: {
                apiKey:clientSecret.secretValueFromJson('apiKey').toString(),
                InstanceUrl: clientSecret.secretValueFromJson('instanceUrl').toString(),
          },
        },
      },
    });
  });

  


});
