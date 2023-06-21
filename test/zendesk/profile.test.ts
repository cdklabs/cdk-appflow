/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';

import {
  ZendeskConnectorProfile, ZendeskInstanceUrlBuilder,
} from '../../src';

describe('ZendeskConnectorProfile', () => {

  test('OAuth2 profile with direct client credentials exists in the stack', () => {
    const stack = new Stack(undefined, 'TestStack', { env: { account: '12345678', region: 'dummy' } });

    new ZendeskConnectorProfile(stack, 'TestProfile', {
      oAuth: {
        accessToken: 'accessToken',
        clientId: 'clientId',
        clientSecret: 'clientSecret',
      },
      instanceUrl: ZendeskInstanceUrlBuilder.buildFromAccount('zendeskAccount'),
    });

    Template.fromStack(stack).hasResourceProperties('AWS::AppFlow::ConnectorProfile', {
      ConnectionMode: 'Public',
      ConnectorProfileName: 'TestProfile',
      ConnectorType: 'Zendesk',
      ConnectorProfileConfig: {
        ConnectorProfileCredentials: {
          Zendesk: {
            AccessToken: 'accessToken',
            ClientId: 'clientId',
            ClientSecret: 'clientSecret',
          },
        },
        ConnectorProfileProperties: {
          Zendesk: {
            InstanceUrl: 'https://zendeskAccount.zendesk.com',
          },
        },
      },
    });
  });

  test('OAuth2 profile with client credentials as secret elements exists in the stack', () => {
    const stack = new Stack(undefined, 'TestStack', { env: { account: '12345678', region: 'dummy' } });

    const secret = new Secret(stack, 'TestSecret');

    new ZendeskConnectorProfile(stack, 'TestProfile', {
      oAuth: {
        accessToken: secret.secretValueFromJson('accessToken').toString(),
        clientId: secret.secretValueFromJson('clientId').toString(),
        clientSecret: secret.secretValueFromJson('clientSecret').toString(),
      },
      instanceUrl: secret.secretValueFromJson('instanceUrl').toString(),
    });

    Template.fromStack(stack).hasResourceProperties('AWS::AppFlow::ConnectorProfile', {
      ConnectionMode: 'Public',
      ConnectorProfileName: 'TestProfile',
      ConnectorType: 'Zendesk',
      ConnectorProfileConfig: {
        ConnectorProfileCredentials: {
          Zendesk: {
            AccessToken: {
              'Fn::Join': [
                '',
                [
                  '{{resolve:secretsmanager:',
                  {
                    Ref: 'TestSecret16AF87B1',
                  },
                  ':SecretString:accessToken::}}',
                ],
              ],
            },
            ClientId: {
              'Fn::Join': [
                '',
                [
                  '{{resolve:secretsmanager:',
                  {
                    Ref: 'TestSecret16AF87B1',
                  },
                  ':SecretString:clientId::}}',
                ],
              ],
            },
            ClientSecret: {
              'Fn::Join': [
                '',
                [
                  '{{resolve:secretsmanager:',
                  {
                    Ref: 'TestSecret16AF87B1',
                  },
                  ':SecretString:clientSecret::}}',
                ],
              ],
            },
          },
        },
        ConnectorProfileProperties: {
          Zendesk: {
            InstanceUrl: {
              'Fn::Join': [
                '',
                [
                  '{{resolve:secretsmanager:',
                  {
                    Ref: 'TestSecret16AF87B1',
                  },
                  ':SecretString:instanceUrl::}}',
                ],
              ],
            },
          },
        },
      },
    });
  });


  test('OAuth2 profile with a dedicated KMS key and client credentials as secret elements exists in the stack', () => {
    const stack = new Stack(undefined, 'TestStack', { env: { account: '12345678', region: 'dummy' } });

    const key = new Key(stack, 'TestKey');

    const secret = new Secret(stack, 'TestSecret');

    new ZendeskConnectorProfile(stack, 'TestProfile', {
      key: key,
      oAuth: {
        accessToken: secret.secretValueFromJson('accessToken').toString(),
        clientId: secret.secretValueFromJson('clientId').toString(),
        clientSecret: secret.secretValueFromJson('clientSecret').toString(),
      },
      instanceUrl: secret.secretValueFromJson('instanceUrl').toString(),
    });

    Template.fromStack(stack).hasResource('AWS::AppFlow::ConnectorProfile', {
      Properties: {
        ConnectionMode: 'Public',
        ConnectorProfileName: 'TestProfile',
        ConnectorType: 'Zendesk',
        ConnectorProfileConfig: {
          ConnectorProfileCredentials: {
            Zendesk: {
              AccessToken: {
                'Fn::Join': [
                  '',
                  [
                    '{{resolve:secretsmanager:',
                    {
                      Ref: 'TestSecret16AF87B1',
                    },
                    ':SecretString:accessToken::}}',
                  ],
                ],
              },
              ClientId: {
                'Fn::Join': [
                  '',
                  [
                    '{{resolve:secretsmanager:',
                    {
                      Ref: 'TestSecret16AF87B1',
                    },
                    ':SecretString:clientId::}}',
                  ],
                ],
              },
              ClientSecret: {
                'Fn::Join': [
                  '',
                  [
                    '{{resolve:secretsmanager:',
                    {
                      Ref: 'TestSecret16AF87B1',
                    },
                    ':SecretString:clientSecret::}}',
                  ],
                ],
              },
            },
          },
          ConnectorProfileProperties: {
            Zendesk: {
              InstanceUrl: {
                'Fn::Join': [
                  '',
                  [
                    '{{resolve:secretsmanager:',
                    {
                      Ref: 'TestSecret16AF87B1',
                    },
                    ':SecretString:instanceUrl::}}',
                  ],
                ],
              },
            },
          },
        },
        KMSArn: {
          'Fn::GetAtt': [
            'TestKey4CACAF33',
            'Arn',
          ],
        },
      },
      DependsOn: [
        'TestKey4CACAF33',
      ],
    });
  });

});