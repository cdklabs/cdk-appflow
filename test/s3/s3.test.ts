/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import {
  Mapping,
  OnDemandFlow,
  S3OutputAggregationType,
  S3Destination,
  S3OutputFileType,
  S3InputFileType,
  S3Source,
  S3OutputFilePrefixFormat,
  S3OutputFilePrefixHierarchy,
} from '../../src';

describe('S3 Flow tests', () => {
  test('Source and Destination with a bucket', () => {
    const stack = new Stack(undefined, undefined);
    const bucket = new Bucket(stack, 'TestBucket', {
      bucketName: 'test-bucket',
    });

    const source = new S3Source({
      bucket: bucket,
      prefix: 'prefix',
    });

    const destination = new S3Destination({
      location: { bucket },
    });

    new OnDemandFlow(stack, 'testFlow', {
      source: source,
      destination,
      mappings: [Mapping.mapAll()],
    });

    const template = Template.fromStack(stack);

    template.resourceCountIs('AWS::S3::Bucket', 1);
    template.resourceCountIs('AWS::AppFlow::Flow', 1);

    template.hasResourceProperties('AWS::AppFlow::Flow', {
      DestinationFlowConfigList: [
        {
          ConnectorType: 'S3',
          DestinationConnectorProperties: {
            S3: {
              BucketName: {
                Ref: 'TestBucket560B80BC',
              },
            },
          },
        },
      ],
      FlowName: 'testFlow',
      SourceFlowConfig: {
        ConnectorType: 'S3',
        SourceConnectorProperties: {
          S3: {
            BucketName: {
              Ref: 'TestBucket560B80BC',
            },
            BucketPrefix: 'prefix',
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

  test('Source and Destination with a bucket name', () => {
    const stack = new Stack(undefined, undefined);

    const bucket = Bucket.fromBucketName(stack, 'TestBucket', 'test-bucket');

    const source = new S3Source({
      bucket: bucket,
      prefix: 'source-prefix',
      format: {
        type: S3InputFileType.JSON,
      },
    });

    const destination = new S3Destination({
      location: { bucket: bucket },
      formatting: {
        aggregation: {
          type: S3OutputAggregationType.SINGLE_FILE,
          fileSize: 1024,
        },
        fileType: S3OutputFileType.CSV,
        filePrefix: {
          hierarchy: [S3OutputFilePrefixHierarchy.SCHEMA_VERSION],
          format: S3OutputFilePrefixFormat.HOUR,
        },
      },
    });

    new OnDemandFlow(stack, 'testFlow', {
      source: source,
      destination,
      mappings: [Mapping.mapAll({ exclude: ['field1', 'field2'] })],
    });

    const template = Template.fromStack(stack);

    template.resourceCountIs('AWS::S3::Bucket', 0);
    template.resourceCountIs('AWS::AppFlow::Flow', 1);

    template.hasResourceProperties('AWS::AppFlow::Flow', {
      DestinationFlowConfigList: [
        {
          ConnectorType: 'S3',
          DestinationConnectorProperties: {
            S3: {
              BucketName: 'test-bucket',
              S3OutputFormatConfig: {
                AggregationConfig: {
                  AggregationType: 'SingleFile',
                  TargetFileSize: 1024,
                },
                FileType: 'CSV',
                PrefixConfig: {
                  PathPrefixHierarchy: [
                    'SCHEMA_VERSION',
                  ],
                  PrefixFormat: 'HOUR',
                },
              },
            },
          },
        },
      ],
      FlowName: 'testFlow',
      SourceFlowConfig: {
        ConnectorType: 'S3',
        SourceConnectorProperties: {
          S3: {
            BucketName: 'test-bucket',
            BucketPrefix: 'source-prefix',
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
              Value: '[\"field1\",\"field2\"]',
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