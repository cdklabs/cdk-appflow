/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import {
  OnDemandFlow,
  S3Destination,
  Mapping, S3Source, S3InputFileType, S3ConnectorType,
} from '../../src';

describe('S3Source', () => {

  test('Source', () => {
    const stack = new Stack(undefined, 'TestStack');

    const bucket = new Bucket(stack, 'TestBucket', {
      bucketName: 'test-bucket',
    });

    const source = new S3Source({
      bucket: bucket,
      prefix: 'prefix',
      format: {
        type: S3InputFileType.CSV,
      },
    });

    const destination = new S3Destination({
      location: {
        bucket,
      },
    });

    new OnDemandFlow(stack, 'TestFlow', {
      source: source,
      destination: destination,
      mappings: [Mapping.mapAll()],
    });


    const expectedConnectorType = S3ConnectorType.instance;
    expect(source.connectorType.asProfileConnectorLabel).toEqual(expectedConnectorType.asProfileConnectorLabel);
    expect(source.connectorType.asProfileConnectorType).toEqual(expectedConnectorType.asProfileConnectorType);
    expect(source.connectorType.asTaskConnectorOperatorOrigin).toEqual(expectedConnectorType.asTaskConnectorOperatorOrigin);
    expect(source.connectorType.isCustom).toEqual(expectedConnectorType.isCustom);
  });

  test('Flow source template is valid', () => {
    const stack = new Stack(undefined, 'TestStack');

    const bucket = new Bucket(stack, 'TestBucket', {
      bucketName: 'test-bucket',
    });

    const source = new S3Source({
      bucket: bucket,
      prefix: 'prefix',
      format: {
        type: S3InputFileType.CSV,
      },
    });

    const destination = new S3Destination({
      location: {
        bucket,
      },
    });

    new OnDemandFlow(stack, 'TestFlow', {
      source: source,
      destination: destination,
      mappings: [Mapping.mapAll()],
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::AppFlow::Flow', {
      SourceFlowConfig: {
        ConnectorType: 'S3',
        SourceConnectorProperties: {
          S3: {
            BucketName: {
              Ref: 'TestBucket560B80BC',
            },
            BucketPrefix: 'prefix',
            S3InputFormatConfig: {
              S3InputFileType: 'CSV',
            },
          },
        },
      },
    });
  });

  test('Only known S3InputFileType specified', () => {
    const expectedTypes = [
      'CSV',
      'JSON',
    ];
    const actualTypes = Object.values(S3InputFileType);

    expect(actualTypes).toEqual(expectedTypes);
  });
});
