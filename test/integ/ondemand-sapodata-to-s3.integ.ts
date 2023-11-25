/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { App, RemovalPolicy, Stack, Token } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import {
  Mapping,
  OnDemandFlow,
  S3Destination,
  SAPOdataConnectorProfile,
  SAPOdataSource,
} from '../../src';

const app = new App({
  treeMetadata: false,
});

const stack = new Stack(app, 'TestStack');

const secret = Secret.fromSecretNameV2(stack, 'TestSecret', 'appflow/sap/basic');

const profile = new SAPOdataConnectorProfile(stack, 'TestConnectorProfile', {
  basicAuth: {
    username: secret.secretValueFromJson('username').toString(),
    password: secret.secretValueFromJson('password'),
  },
  applicationHostUrl: secret.secretValueFromJson('appHostUrl').toString(),
  applicationServicePath: secret.secretValueFromJson('servicePath').toString(),
  portNumber: Token.asNumber(secret.secretValueFromJson('portNumber')),
  clientNumber: secret.secretValueFromJson('clientNumber').toString(),
  logonLanguage: secret.secretValueFromJson('logonLanguage').toString(),
});

const source = new SAPOdataSource({
  profile: profile,
  object: secret.secretValueFromJson('objectName').toString(),
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