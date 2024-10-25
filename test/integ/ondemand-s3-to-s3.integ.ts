/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { App, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import {
  Mapping,
  OnDemandFlow,
  S3Destination, S3InputFileType, S3OutputAggregationType,
  S3OutputFilePrefixHierarchy, S3OutputFilePrefixType,
  S3OutputFileType, S3Source,
} from '../../src';

const app = new App({
  treeMetadata: false,
});

const stack = new Stack(app, 'TestStack');

const sourceBucket = new Bucket(stack, 'TestSourceBucket', {
  autoDeleteObjects: true,
  removalPolicy: RemovalPolicy.DESTROY,
});

const destinationBucket = new Bucket(stack, 'TestDestinationBucket', {
  autoDeleteObjects: true,
  removalPolicy: RemovalPolicy.DESTROY,
});

const deployment = new BucketDeployment(stack, 'TestDeployment', {
  sources: [Source.jsonData('init.json', { Name: 'name' })],
  destinationBucket: sourceBucket,
  destinationKeyPrefix: 'account',
});

const source = new S3Source({
  bucket: sourceBucket,
  prefix: 'account',
  format: {
    type: S3InputFileType.JSON,
  },
});

const destination = new S3Destination({
  location: { bucket: destinationBucket },
  formatting: {
    fileType: S3OutputFileType.PARQUET,
    filePrefix: {
      type: S3OutputFilePrefixType.FILENAME,
      hierarchy: [
        S3OutputFilePrefixHierarchy.SCHEMA_VERSION,
        S3OutputFilePrefixHierarchy.EXECUTION_ID,
      ],
    },
    aggregation: { type: S3OutputAggregationType.NONE },
    preserveSourceDataTypes: true,
  },
});

const flow = new OnDemandFlow(stack, 'OnDemandFlow', {
  source: source,
  destination: destination,
  mappings: [Mapping.mapAll()],
});

flow.node.addDependency(deployment);

app.synth();