/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import {
  OnDemandFlow,
  S3Source,
  S3Destination,
  Mapping,
} from '../../../src';

describe('OnDemandFlow', () => {
  test('', () => {

    const stack = new Stack(undefined, 'TestStack');

    const bucket = new Bucket(stack, 'TestBucket');

    const source = new S3Source({
      bucket: bucket,
      prefix: 'account',
    });

    const destination = new S3Destination({
      location: { bucket, prefix: 'new-account' },
    });


    new OnDemandFlow(stack, 'OnDemandFlow', {
      source,
      destination,
      key: new Key(stack, 'TestKey'),
      mappings: [Mapping.mapAll()],
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::AppFlow::Flow', {
      DestinationFlowConfigList: [
        {
          ConnectorType: 'S3',
          DestinationConnectorProperties: {
            S3: {
              BucketName: {
                Ref: 'TestBucket560B80BC',
              },
              BucketPrefix: 'new-account',
            },
          },
        },
      ],
      FlowName: 'OnDemandFlow',
      SourceFlowConfig: {
        ConnectorType: 'S3',
        SourceConnectorProperties: {
          S3: {
            BucketName: {
              Ref: 'TestBucket560B80BC',
            },
            BucketPrefix: 'account',
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
      KMSArn: {
        'Fn::GetAtt': [
          'TestKey4CACAF33',
          'Arn',
        ],
      },
    });

  });
});