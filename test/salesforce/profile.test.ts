/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';

import { SalesforceConnectorProfile } from '../../src';

describe('SalesforceConnectorProfileProps', () => {

  test('OAuth2 profile with direct client credentials exists in the stack', () => {
    const stack = new Stack(undefined, 'TestStack', { env: { account: '12345678', region: 'dummy' } });

    const clientSecret = new Secret(stack, 'TestSecret');

    new SalesforceConnectorProfile(stack, 'TestProfile', {
      oAuth: {
        accessToken: 'accessToken',
        flow: {
          refreshTokenGrant: {
            refreshToken: 'refreshToken',
            client: clientSecret,
          },
        },
      },
      instanceUrl: 'https://instance-id.develop.my.salesforce.com',
    });
    Template.fromStack(stack).hasResourceProperties('AWS::AppFlow::ConnectorProfile', {
      ConnectionMode: 'Public',
      ConnectorProfileName: 'TestProfile',
      ConnectorType: 'Salesforce',
      ConnectorProfileConfig: {
        ConnectorProfileCredentials: {
          Salesforce: {
            AccessToken: 'accessToken',
            ClientCredentialsArn: {
              Ref: 'TestSecret16AF87B1',
            },
            RefreshToken: 'refreshToken',
          },
        },
        ConnectorProfileProperties: {
          Salesforce: {
            InstanceUrl: 'https://instance-id.develop.my.salesforce.com',
          },
        },
      },
    });
  });

  test('OAuth2 profile with client credentials as secret elements exists in the stack', () => {
    const stack = new Stack(undefined, 'TestStack', { env: { account: '12345678', region: 'dummy' } });

    const secret = new Secret(stack, 'TestSecret');

    new SalesforceConnectorProfile(stack, 'TestProfile', {
      oAuth: {
        accessToken: secret.secretValueFromJson('accessToken').toString(),
        flow: {
          refreshTokenGrant: {
            refreshToken: secret.secretValueFromJson('refreshToken').toString(),
            client: secret,
          },
        },
      },
      instanceUrl: secret.secretValueFromJson('instanceUrl').toString(),
    });
    Template.fromStack(stack).hasResourceProperties('AWS::AppFlow::ConnectorProfile', {
      ConnectionMode: 'Public',
      ConnectorProfileConfig: {
        ConnectorProfileCredentials: {
          Salesforce: {
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
            ClientCredentialsArn: {
              Ref: 'TestSecret16AF87B1',
            },
            RefreshToken: {
              'Fn::Join': [
                '',
                [
                  '{{resolve:secretsmanager:',
                  {
                    Ref: 'TestSecret16AF87B1',
                  },
                  ':SecretString:refreshToken::}}',
                ],
              ],
            },
          },
        },
        ConnectorProfileProperties: {
          Salesforce: {
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
      ConnectorProfileName: 'TestProfile',
      ConnectorType: 'Salesforce',
    });
  });


  test('OAuth2 profile with a dedicated KMS key and client credentials as secret elements exists in the stack', () => {
    const stack = new Stack(undefined, 'TestStack', { env: { account: '12345678', region: 'dummy' } });

    const key = new Key(stack, 'TestKey');

    const secret = new Secret(stack, 'TestSecret');

    new SalesforceConnectorProfile(stack, 'TestProfile', {
      key: key,
      oAuth: {
        accessToken: secret.secretValueFromJson('accessToken').toString(),
        flow: {
          refreshTokenGrant: {
            refreshToken: secret.secretValueFromJson('refreshToken').toString(),
            client: secret,
          },
        },
      },
      instanceUrl: secret.secretValueFromJson('instanceUrl').toString(),
    });

    Template.fromStack(stack).hasResource('AWS::AppFlow::ConnectorProfile', {
      DependsOn: [
        'TestKey4CACAF33',
        'TestSecret16AF87B1',
      ],
      Properties: {
        ConnectionMode: 'Public',
        ConnectorProfileConfig: {
          ConnectorProfileCredentials: {
            Salesforce: {
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
              ClientCredentialsArn: {
                Ref: 'TestSecret16AF87B1',
              },
              RefreshToken: {
                'Fn::Join': [
                  '',
                  [
                    '{{resolve:secretsmanager:',
                    {
                      Ref: 'TestSecret16AF87B1',
                    },
                    ':SecretString:refreshToken::}}',
                  ],
                ],
              },
            },
          },
          ConnectorProfileProperties: {
            Salesforce: {
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
        ConnectorProfileName: 'TestProfile',
        ConnectorType: 'Salesforce',
        KMSArn: {
          'Fn::GetAtt': [
            'TestKey4CACAF33',
            'Arn',
          ],
        },
      },
      Type: 'AWS::AppFlow::ConnectorProfile',
    });
  });

});
