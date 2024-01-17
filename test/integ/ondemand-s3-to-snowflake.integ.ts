/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { App, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import {
  Mapping,
  OnDemandFlow,
  S3InputFileType,
  S3Source,
  SnowflakeConnectorProfile,
  SnowflakeDestination,
} from '../../src';

const app = new App({
  treeMetadata: false,
});

const stack = new Stack(app, 'TestStack');

const bucket = new Bucket(stack, 'TestBucket', {
  autoDeleteObjects: true,
  removalPolicy: RemovalPolicy.DESTROY,
});

const deployment = new BucketDeployment(stack, 'TestDeployment', {
  sources: [Source.jsonData('init.json', { Name: 'name' })],
  destinationBucket: bucket,
  destinationKeyPrefix: 'account',
});

const source = new S3Source({
  bucket: bucket,
  prefix: 'account',
  format: {
    type: S3InputFileType.JSON,
  },
});
const secret = Secret.fromSecretNameV2(stack, 'SnowTestSecret', 'appflow/snowflake');

const dataBucket = Bucket.fromBucketAttributes(stack, 'ImportedBucket', {
  bucketName: secret.secretValueFromJson('bucketName').toString(),
});

const snowProfile = new SnowflakeConnectorProfile(stack, 'SnowTestConnector', {
  account: secret.secretValueFromJson('account').toString(),
  region: secret.secretValueFromJson('region').toString(),
  basicAuth: {
    username: secret.secretValueFromJson('username').toString(),
    password: secret.secretValueFromJson('password'),
  },
  warehouse: secret.secretValueFromJson('warehouse').toString(),
  database: secret.secretValueFromJson('database').toString(),
  schema: secret.secretValueFromJson('schema').toString(),
  stage: secret.secretValueFromJson('stage').toString(),
  location: {
    bucket: dataBucket,
  },
});

const destination = new SnowflakeDestination({
  profile: snowProfile,
  object: {
    table: secret.secretValueFromJson('table').toString(),
  },
  errorHandling: {
    errorLocation: {
      bucket: dataBucket,
      prefix: 'error',
    },
  },
});

const flow = new OnDemandFlow(stack, 'OnDemandFlow', {
  source: source,
  destination: destination,
  mappings: [Mapping.mapAll()],
});

flow.node.addDependency(deployment);

app.synth();