/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { App, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import {
  MailChimpApiVersion,
  MailChimpConnectorProfile,
  MailChimpSource,
  Mapping,
  OnDemandFlow,
  S3Destination,
} from '../../src';

const app = new App({
  treeMetadata: false,
});

const stack = new Stack(app, 'TestStack');

const secret = Secret.fromSecretNameV2(stack, 'TestSecret', 'appflow/mailchimp');
// const secret = new Secret(stack, 'TestSecret', {
//   secretName: 'appflow/mailchimp',
//   removalPolicy: RemovalPolicy.DESTROY,
//   secretObjectValue: {
//     "apiKey":SecretValue.unsafePlainText(""),
//     "instanceUrl":SecretValue.unsafePlainText("https://<<region>>.api.mailchimp.com")
//   },
// })

const profile = new MailChimpConnectorProfile(stack, 'TestConnectorProfile', {
  apiKey: secret.secretValueFromJson('apiKey'),
  instanceUrl: secret.secretValueFromJson('instanceUrl').toString(),
});

const source = new MailChimpSource({
  profile: profile,
  apiVersion: MailChimpApiVersion.V3,
  object: 'campaigns',
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