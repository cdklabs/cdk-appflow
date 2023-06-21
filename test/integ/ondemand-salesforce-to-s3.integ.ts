/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Database } from '@aws-cdk/aws-glue-alpha';
import { App, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import {
  Filter,
  FilterCondition,
  Mapping,
  OnDemandFlow,
  S3Destination,
  S3OutputFilePrefixHierarchy,
  S3OutputFileType,
  SalesforceConnectorProfile,
  SalesforceSource,
} from '../../src';

const app = new App({
  treeMetadata: false,
});

const stack = new Stack(app, 'TestStack');

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

const source = new SalesforceSource({
  profile: profile,
  object: 'Contact',
});

const bucket = new Bucket(stack, 'TestBucket', {
  autoDeleteObjects: true,
  removalPolicy: RemovalPolicy.DESTROY,
});

const destination = new S3Destination({
  location: { bucket },
  formatting: {
    filePrefix: {
      hierarchy: [S3OutputFilePrefixHierarchy.SCHEMA_VERSION, S3OutputFilePrefixHierarchy.EXECUTION_ID],
    },
    fileType: S3OutputFileType.JSON,
  },
  catalog: {
    database: new Database(stack, 'TestDatabase', { databaseName: 'testdb' }),
    tablePrefix: 'test_prefix',
  },
});

new OnDemandFlow(stack, 'OnDemandFlow', {
  source: source,
  destination: destination,
  mappings: [Mapping.mapAll()],
  filters: [
    Filter.when(
      FilterCondition.timestampGreaterThanEquals({ name: 'LastModifiedDate', dataType: 'datetime' }, new Date(Date.parse('2022-02-02')))),
  ],
});

app.synth();