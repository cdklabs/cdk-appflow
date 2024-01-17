/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { SecretValue, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';

import {
  SlackConnectorProfile, SlackInstanceUrlBuilder,
} from '../../src';

describe('SlackConnectorProfile', () => {

  test('OAuth2 profile with direct client credentials exists in the stack', () => {
    const stack = new Stack(undefined, 'TestStack', { env: { account: '12345678', region: 'dummy' } });

    new SlackConnectorProfile(stack, 'TestProfile', {
      oAuth: {
        accessToken: SecretValue.unsafePlainText('accessToken'),
        clientId: SecretValue.unsafePlainText('clientId'),
        clientSecret: SecretValue.unsafePlainText('clientSecret'),
      },
      instanceUrl: SlackInstanceUrlBuilder.buildFromWorkspace('slackWorkspace'),
    });

    Template.fromStack(stack).hasResourceProperties('AWS::AppFlow::ConnectorProfile', {
      ConnectionMode: 'Public',
      ConnectorProfileName: 'TestProfile',
      ConnectorType: 'Slack',
      ConnectorProfileConfig: {
        ConnectorProfileCredentials: {
          Slack: {
            AccessToken: 'accessToken',
            ClientId: 'clientId',
            ClientSecret: 'clientSecret',
          },
        },
        ConnectorProfileProperties: {
          Slack: {
            InstanceUrl: 'https://slackWorkspace.slack.com',
          },
        },
      },
    });
  });

  test('OAuth2 profile with client credentials as secret elements exists in the stack', () => {
    const stack = new Stack(undefined, 'TestStack', { env: { account: '12345678', region: 'dummy' } });

    const secret = new Secret(stack, 'TestSecret');

    new SlackConnectorProfile(stack, 'TestProfile', {
      oAuth: {
        accessToken: secret.secretValueFromJson('accessToken'),
        clientId: secret.secretValueFromJson('clientId'),
        clientSecret: secret.secretValueFromJson('clientSecret'),
      },
      instanceUrl: secret.secretValueFromJson('instanceUrl').toString(),
    });

    Template.fromStack(stack).hasResourceProperties('AWS::AppFlow::ConnectorProfile', {
      ConnectionMode: 'Public',
      ConnectorProfileName: 'TestProfile',
      ConnectorType: 'Slack',
      ConnectorProfileConfig: {
        ConnectorProfileCredentials: {
          Slack: {
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
          Slack: {
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

    new SlackConnectorProfile(stack, 'TestProfile', {
      key: key,
      oAuth: {
        accessToken: secret.secretValueFromJson('accessToken'),
        clientId: secret.secretValueFromJson('clientId'),
        clientSecret: secret.secretValueFromJson('clientSecret'),
      },
      instanceUrl: secret.secretValueFromJson('instanceUrl').toString(),
    });

    Template.fromStack(stack).hasResource('AWS::AppFlow::ConnectorProfile', {
      Properties: {
        ConnectionMode: 'Public',
        ConnectorProfileName: 'TestProfile',
        ConnectorType: 'Slack',
        ConnectorProfileConfig: {
          ConnectorProfileCredentials: {
            Slack: {
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
            Slack: {
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