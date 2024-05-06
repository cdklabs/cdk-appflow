/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { SecretValue, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';

import {
    GoogleAdsConnectorProfile,
    GoogleAdsApiVersion,
} from '../../src';

describe('GoogleAdsConnectorProfile', () => {

  test('OAuth2 profile with direct client credentials exists in the stack', () => {
    const stack = new Stack(undefined, 'TestStack', { env: { account: '12345678', region: 'dummy' } });

    // readonly oAuth: GoogleAdsOAuthSettings;
    // readonly apiVersion: string;
    // readonly managerID: string;
    // readonly developerToken: string;
    new GoogleAdsConnectorProfile(stack, 'TestProfile', {
      oAuth: {
        accessToken: SecretValue.unsafePlainText('accessToken'),
        flow: {
          refreshTokenGrant: {
            refreshToken: SecretValue.unsafePlainText('refreshToken'),
            clientId: SecretValue.unsafePlainText('clientId'),
            clientSecret: SecretValue.unsafePlainText('clientSecret'),
          },
        },
      },
      apiVersion:GoogleAdsApiVersion.V14,
      managerID:SecretValue.unsafePlainText('managerId'),
      developerToken:SecretValue.unsafePlainText('developerToken')
    });


    Template.fromStack(stack).hasResourceProperties('AWS::AppFlow::ConnectorProfile', {
      ConnectionMode: 'Public',
      ConnectorProfileName: 'TestProfile',
      ConnectorType: 'CustomConnector',
      ConnectorLabel: 'Google Ads',
      ConnectorProfileConfig: {
        ConnectorProfileCredentials: {
          CustomConnector: {
            AuthenticationType: 'OAUTH2',
            Oauth2: {
              AccessToken: 'accessToken',
              ClientId: 'clientId',
              ClientSecret: 'clientSecret',
              RefreshToken: 'refreshToken',
            },
          },
        },
        ConnectorProfileProperties: {
          CustomConnector: {
            OAuth2Properties: {
              OAuth2GrantType: 'AUTHORIZATION_CODE',
              TokenUrl: 'https://oauth2.googleapis.com/token',
            },
          },
        },
      },
    });
  });
});