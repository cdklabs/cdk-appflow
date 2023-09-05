/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { App, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Schedule } from 'aws-cdk-lib/aws-events';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import {
  SalesforceDestination,
  S3Source,
  S3InputFileType,
  Mapping,
  OnScheduleFlow,
  DataPullMode,
  Validation,
  ValidationCondition,
  ValidationAction,
  Transform,
  WriteOperation,
  SalesforceConnectorProfile,
  FlowStatus,
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

const secret = Secret.fromSecretNameV2(stack, 'TestSecret', 'appflow/salesforce/client');

const profile = new SalesforceConnectorProfile(stack, 'TestConnectorProfile', {
  oAuth: {
    flow: {
      refresTokenGrant: {
        refreshToken: secret.secretValueFromJson('refreshToken').toString(),
        client: secret,
      },
    },
  },
  instanceUrl: secret.secretValueFromJson('instanceUrl').toString(),
  isSandbox: false,
});

const destination = new SalesforceDestination({
  profile: profile,
  object: 'Account',
  operation: WriteOperation.insert(),
});

const flow = new OnScheduleFlow(stack, 'OnScheduleFlow', {
  source: source,
  destination: destination,
  mappings: [Mapping.map({ name: 'Name', dataType: 'string' }, { name: 'Name', dataType: 'string' })],
  transforms: [
    Transform.mask({ name: 'Name' }, '*'),
  ],
  validations: [
    Validation.when(ValidationCondition.isNull('Name'), ValidationAction.ignoreRecord()),
  ],
  schedule: Schedule.rate(Duration.minutes(10)),
  pullConfig: { mode: DataPullMode.INCREMENTAL },
  scheduleProperties: {
    startTime: new Date(Date.parse('2024-01-01')),
  },
  status: FlowStatus.ACTIVE,
});

flow.node.addDependency(deployment);
flow.onRunCompleted('captureOnRunCompleted');
flow.onDeactivated('captureOnDeactivated');

app.synth();