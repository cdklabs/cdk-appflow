/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { App, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Mapping, MicrosoftDynamics365ApiVersion, MicrosoftDynamics365ConnectorProfile, MicrosoftDynamics365Source, OnDemandFlow, S3Destination, S3OutputAggregationType } from '../../src';

const app = new App({
  treeMetadata: false,
});

const stack = new Stack(app, 'TestStack', {
  env: {
    region: 'us-east-1',
  },
});

const secret = Secret.fromSecretNameV2(stack, 'TestSecret', 'appflow/msdynamics365');

const profile = new MicrosoftDynamics365ConnectorProfile(stack, 'TestConnector', {
  oAuth: {
    accessToken: secret.secretValueFromJson('accessToken').toString(),
    flow: {
      refreshTokenGrant: {
        refreshToken: secret.secretValueFromJson('refreshToken').toString(),
        clientId: secret.secretValueFromJson('clientId').toString(),
        clientSecret: secret.secretValueFromJson('clientSecret').toString(),
      },
    },
  },
  instanceUrl: secret.secretValueFromJson('instanceUrl').toString(),
});

const source = new MicrosoftDynamics365Source({
  profile: profile,
  apiVersion: MicrosoftDynamics365ApiVersion.V9_2,
  object: secret.secretValueFromJson('object').toString(),
});

const bucket = new Bucket(stack, 'TestBucket', {
  autoDeleteObjects: true,
  removalPolicy: RemovalPolicy.DESTROY,
});

const destination = new S3Destination({
  location: { bucket },
  formatting: {
    aggregation: {
      type: S3OutputAggregationType.SINGLE_FILE,
    },
  },
});

new OnDemandFlow(stack, 'OnDemandFlow', {
  source: source,
  destination: destination,
  mappings: [Mapping.mapAll()],
});

app.synth();
