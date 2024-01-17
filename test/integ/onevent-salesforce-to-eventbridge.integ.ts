/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { App, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import {
  EventBridgeDestination,
  SalesforceSource,
  EventSources,
  Mapping,
  OnEventFlow,
  SalesforceConnectorProfile,
} from '../../src';

const app = new App({
  treeMetadata: false,
});

const stack = new Stack(app, 'TestStack');

const secret = Secret.fromSecretNameV2(stack, 'TestSecret', 'appflow/salesforce/client');

const profile = new SalesforceConnectorProfile(stack, 'TestConnectorProfile', {
  oAuth: {
    flow: {
      refreshTokenGrant: {
        refreshToken: secret.secretValueFromJson('refreshToken'),
        client: secret,
      },
    },
  },
  instanceUrl: secret.secretValueFromJson('instanceUrl').toString(),
  isSandbox: false,
});

const source = new SalesforceSource({
  profile: profile,
  object: 'AccountChangeEvent',
});

const bucket = new Bucket(stack, 'TestBucket', {
  autoDeleteObjects: true,
  removalPolicy: RemovalPolicy.DESTROY,
});

const destination = new EventBridgeDestination({
  partnerBus: EventSources.salesforceEventSource('test'),
  errorHandling: { errorLocation: { bucket } },
});

const flow = new OnEventFlow(stack, 'EventFlow', {
  source: source,
  destination: destination,
  mappings: [Mapping.mapAll()],
});

flow.onRunStarted('captureOnRunStarted');

app.synth();