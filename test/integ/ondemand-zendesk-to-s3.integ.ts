/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { App, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import {
  Mapping,
  OnDemandFlow,
  S3Destination,
  ZendeskConnectorProfile, ZendeskSource,
} from '../../src';

const app = new App({
  treeMetadata: false,
});

const stack = new Stack(app, 'TestStack');

const secret = Secret.fromSecretNameV2(stack, 'TestSecret', 'appflow/zendesk');

const profile = new ZendeskConnectorProfile(stack, 'TestConnectorProfile', {
  oAuth: {
    accessToken: secret.secretValueFromJson('accessToken').toString(),
    clientId: secret.secretValueFromJson('clientId').toString(),
    clientSecret: secret.secretValueFromJson('clientSecret').toString(),
  },
  instanceUrl: secret.secretValueFromJson('instanceUrl').toString(),
});

const source = new ZendeskSource({
  profile: profile,
  object: secret.secretValueFromJson('object').toString(),
});

const bucket = new Bucket(stack, 'TestBucket', {
  autoDeleteObjects: true,
  removalPolicy: RemovalPolicy.DESTROY,
});

const destination = new S3Destination({
  location: { bucket },
});

new OnDemandFlow(stack, 'OnDemandFlow', {
  source: source,
  destination: destination,
  mappings: [Mapping.mapAll()],
});

app.synth();