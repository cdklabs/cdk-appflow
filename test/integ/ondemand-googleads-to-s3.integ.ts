/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { App, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import {
  GoogleAdsApiVersion,
  GoogleAdsConnectorProfile,
  GoogleAdsSource,
  OnDemandFlow,
  Mapping,
  S3Destination,
} from '../../src';

const app = new App({
  treeMetadata: false,
});

const stack = new Stack(app, 'TestStack');

const secret = Secret.fromSecretNameV2(stack, 'TestSecret', 'appflow/googleads');

const profile = new GoogleAdsConnectorProfile(stack, 'TestConnector', {
  apiVersion: GoogleAdsApiVersion.V14,
  developerToken: secret.secretValueFromJson('developerToken'),
  // managerID: secret.secretValueFromJson('managerID'),
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

const source = new GoogleAdsSource({
  profile: profile,
  apiVersion: GoogleAdsApiVersion.V14,
  object: secret.secretValueFromJson('sourceObject').toString(),
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
    Mapping.map({ name: 'resourceName', dataType: 'String' }, { name: 'resourceName', dataType: 'String' }),
  ],
});
app.synth();
