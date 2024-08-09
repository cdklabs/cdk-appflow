/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { SecretValue, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AsanaConnectorProfile } from '../../src';

describe('AsanaConnectorProfileProps', () => {

  test('API Key profile with credentials exists in the stack', () => {
    const stack = new Stack(undefined, 'TestStack', { env: { account: '12345678', region: 'dummy' } });

    new AsanaConnectorProfile(stack, 'TestProfile', {
      patToken: SecretValue.unsafePlainText('patToken'),
    });

    Template.fromStack(stack).hasResourceProperties('AWS::AppFlow::ConnectorProfile', {
      ConnectionMode: 'Public',
      ConnectorLabel: 'Asana',
      ConnectorProfileName: 'TestProfile',
      ConnectorType: 'CustomConnector',
      ConnectorProfileConfig: {
        ConnectorProfileCredentials: {
          CustomConnector: {
            AuthenticationType: 'CUSTOM',
            Custom: {
              CredentialsMap: {
                patToken: 'patToken',
              },
              CustomAuthenticationType: 'PAT',
            },
          },
        },
        ConnectorProfileProperties: {
          CustomConnector: {
            ProfileProperties: { },
          },
        },
      },
    });
  });
});
