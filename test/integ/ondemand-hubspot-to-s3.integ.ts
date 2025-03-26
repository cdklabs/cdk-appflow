/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { App, RemovalPolicy, Stack } from "aws-cdk-lib";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import {
  HubSpotApiVersion,
  HubSpotConnectorProfile,
  HubSpotSource,
  Mapping,
  OnDemandFlow,
  S3Destination,
} from "../../src";

const app = new App({
  treeMetadata: false,
});

const stack = new Stack(app, "TestStack");

const secret = Secret.fromSecretNameV2(stack, "TestSecret", "appflow/hubspot");

const profile = new HubSpotConnectorProfile(stack, "TestConnector", {
  oAuth: {
    flow: {
      refreshTokenGrant: {
        refreshToken: secret.secretValueFromJson("refreshToken"),
        clientId: secret.secretValueFromJson("clientId"),
        clientSecret: secret.secretValueFromJson("clientSecret"),
      },
    },
  },
});

const source = new HubSpotSource({
  profile: profile,
  apiVersion: HubSpotApiVersion.V4,
  entity: ["association_label", "ticket", "contact"],
});

const bucket = new Bucket(stack, "TestBucket", {
  autoDeleteObjects: true,
  removalPolicy: RemovalPolicy.DESTROY,
});

const destination = new S3Destination({
  location: { bucket },
});

new OnDemandFlow(stack, "OnDemandFlow", {
  source: source,
  destination: destination,
  mappings: [Mapping.mapAll()],
});

app.synth();
