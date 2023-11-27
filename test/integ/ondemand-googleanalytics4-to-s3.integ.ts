/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { App, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { GoogleAnalytics4ApiVersion, GoogleAnalytics4ConnectorProfile, GoogleAnalytics4Source, Mapping, OnDemandFlow, S3Destination } from '../../src';

const app = new App({
  treeMetadata: false,
});

const stack = new Stack(app, 'TestStack');

const secret = Secret.fromSecretNameV2(stack, 'TestSecret', 'appflow/ga4');

const profile = new GoogleAnalytics4ConnectorProfile(stack, 'TestConnector', {
  oAuth: {
    flow: {
      refreshTokenGrant: {
        refreshToken: secret.secretValueFromJson('refreshToken'),
        clientId: secret.secretValueFromJson('clientId'),
        clientSecret: secret.secretValueFromJson('clientSecret'),
      },
    },
  },
});

const source = new GoogleAnalytics4Source({
  profile: profile,
  apiVersion: GoogleAnalytics4ApiVersion.V1BETA,
  object: secret.secretValueFromJson('coreReport').toString(),
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
  mappings: [
    Mapping.map({ name: 'achievementId', dataType: 'String' }, { name: 'achievementId', dataType: 'String' }),
    Mapping.map({ name: 'adFormat', dataType: 'String' }, { name: 'adFormat', dataType: 'String' }),
    Mapping.map({ name: 'adSourceName', dataType: 'String' }, { name: 'adSourceName', dataType: 'String' }),
  ],
});

app.synth();
