/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { App, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { MicrosoftSharepointOnlineApiVersion, MicrosoftSharepointOnlineConnectorProfile, MicrosoftSharepointOnlineSource, Mapping, OnDemandFlow, S3Destination, MicrosoftSharepointOnlineTokenUrlBuilder, S3OutputAggregationType } from '../../src';

const app = new App({
  treeMetadata: false,
});

const stack = new Stack(app, 'TestStack');

const secret = Secret.fromSecretNameV2(stack, 'TestSecret', 'appflow/mssharepointonline');

const profile = new MicrosoftSharepointOnlineConnectorProfile(stack, 'TestConnector', {
  oAuth: {
    accessToken: secret.secretValueFromJson('accessToken').toString(),
    flow: {
      refreshTokenGrant: {
        refreshToken: secret.secretValueFromJson('refreshToken').toString(),
      },
    },
    endpoints: {
      token: MicrosoftSharepointOnlineTokenUrlBuilder.buildTokenUrl(secret.secretValueFromJson('tenantId').toString()),
    },
  },
});

const source = new MicrosoftSharepointOnlineSource({
  profile: profile,
  apiVersion: MicrosoftSharepointOnlineApiVersion.V1,
  object: {
    site: secret.secretValueFromJson('site').toString(),
    entities: [secret.secretValueFromJson('drive').toString()],
  },
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
