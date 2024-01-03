/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { SecretValue, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Bucket } from 'aws-cdk-lib/aws-s3';

import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import {
  Mapping,
  OnDemandFlow,
  S3InputFileType,
  S3Source,
  SalesforceConnectorProfile,
  SalesforceConnectorType,
  SalesforceDataTransferApi,
  SalesforceDestination,
  WriteOperation,
} from '../../src';

describe('SalesforceDestination', () => {

  test('Destination with only connector name', () => {
    const stack = new Stack(undefined, 'TestStack');
    const destination = new SalesforceDestination({
      profile: SalesforceConnectorProfile.fromConnectionProfileName(stack, 'TestProfile', 'dummy-profile'),
      object: 'Account',
      operation: WriteOperation.insert(),
    });

    const expectedConnectorType = SalesforceConnectorType.instance;
    expect(destination.connectorType.asProfileConnectorLabel).toEqual(expectedConnectorType.asProfileConnectorLabel);
    expect(destination.connectorType.asProfileConnectorType).toEqual(expectedConnectorType.asProfileConnectorType);
    expect(destination.connectorType.asTaskConnectorOperatorOrigin).toEqual(expectedConnectorType.asTaskConnectorOperatorOrigin);
    expect(destination.connectorType.isCustom).toEqual(expectedConnectorType.isCustom);
  });

  test('Destination in a Flow is in the stack', () => {
    const stack = new Stack(undefined, 'TestStack');

    const s3Bucket = new Bucket(stack, 'TestBucket', {});
    const source = new S3Source({
      bucket: s3Bucket,
      prefix: '',
      format: {
        type: S3InputFileType.JSON,
      },
    });

    const destination = new SalesforceDestination({
      profile: SalesforceConnectorProfile.fromConnectionProfileName(stack, 'TestProfile', 'dummy-profile'),
      dataTransferApi: SalesforceDataTransferApi.REST_SYNC,
      object: 'Account',
      operation: WriteOperation.insert(),
    });

    new OnDemandFlow(stack, 'TestFlow', {
      source: source,
      destination: destination,
      mappings: [Mapping.mapAll()],
    });

    Template.fromStack(stack).hasResourceProperties('AWS::AppFlow::Flow', {
      DestinationFlowConfigList: [
        {
          ConnectorProfileName: 'dummy-profile',
          ConnectorType: 'Salesforce',
          DestinationConnectorProperties: {
            Salesforce: {
              DataTransferApi: 'REST_SYNC',
              Object: 'Account',
              WriteOperationType: 'INSERT',
            },
          },
        },
      ],
      FlowName: 'TestFlow',
      SourceFlowConfig: {
        ConnectorType: 'S3',
        SourceConnectorProperties: {
          S3: {
            BucketName: {
              Ref: 'TestBucket560B80BC',
            },
            BucketPrefix: '',
            S3InputFormatConfig: {
              S3InputFileType: 'JSON',
            },
          },
        },
      },
      Tasks: [
        {
          ConnectorOperator: {
            S3: 'NO_OP',
          },
          SourceFields: [],
          TaskProperties: [
            {
              Key: 'EXCLUDE_SOURCE_FIELDS_LIST',
              Value: '[]',
            },
          ],
          TaskType: 'Map_all',
        },
      ],
      TriggerConfig: {
        TriggerType: 'OnDemand',
      },
    });
  });

  test('Destination for dummy-profile in a Flow is in the stack', () => {
    const stack = new Stack(undefined, 'TestStack');

    const secret = Secret.fromSecretNameV2(stack, 'TestSecret', 'appflow/salesforce/client');
    const profile = new SalesforceConnectorProfile(stack, 'TestProfile', {
      oAuth: {
        accessToken: SecretValue.unsafePlainText('accessToken'),
        flow: {
          refreshTokenGrant: {
            refreshToken: SecretValue.unsafePlainText('refreshToken'),
            client: secret,
          },
        },
      },
      instanceUrl: 'https://instance-id.develop.my.salesforce.com',
    });


    const s3Bucket = new Bucket(stack, 'TestBucket', {});
    const source = new S3Source({
      bucket: s3Bucket,
      prefix: '',
      format: {
        type: S3InputFileType.JSON,
      },
    });

    const destination = new SalesforceDestination({
      profile: profile,
      dataTransferApi: SalesforceDataTransferApi.REST_SYNC,
      object: 'Account',
      operation: WriteOperation.insert(),
    });

    new OnDemandFlow(stack, 'TestFlow', {
      source: source,
      destination: destination,
      mappings: [Mapping.mapAll()],
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::AppFlow::ConnectorProfile', {
      ConnectionMode: 'Public',
      ConnectorProfileConfig: {
        ConnectorProfileCredentials: {
          Salesforce: {
            AccessToken: 'accessToken',
            ClientCredentialsArn: {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  {
                    Ref: 'AWS::Partition',
                  },
                  ':secretsmanager:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':secret:appflow/salesforce/client',
                ],
              ],
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
      ConnectorProfileName: 'TestProfile',
      ConnectorType: 'Salesforce',
    });

    template.hasResourceProperties('AWS::AppFlow::Flow', {
      DestinationFlowConfigList: [
        {
          ConnectorProfileName: 'TestProfile',
          ConnectorType: 'Salesforce',
          DestinationConnectorProperties: {
            Salesforce: {
              DataTransferApi: 'REST_SYNC',
              Object: 'Account',
              WriteOperationType: 'INSERT',
            },
          },
        },
      ],
      FlowName: 'TestFlow',
      SourceFlowConfig: {
        ConnectorType: 'S3',
        SourceConnectorProperties: {
          S3: {
            BucketName: {
              Ref: 'TestBucket560B80BC',
            },
            BucketPrefix: '',
            S3InputFormatConfig: {
              S3InputFileType: 'JSON',
            },
          },
        },
      },
      Tasks: [
        {
          ConnectorOperator: {
            S3: 'NO_OP',
          },
          SourceFields: [],
          TaskProperties: [
            {
              Key: 'EXCLUDE_SOURCE_FIELDS_LIST',
              Value: '[]',
            },
          ],
          TaskType: 'Map_all',
        },
      ],
      TriggerConfig: {
        TriggerType: 'OnDemand',
      },
    });
  });
});
