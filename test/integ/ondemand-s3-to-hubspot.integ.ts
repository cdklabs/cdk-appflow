/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { App, RemovalPolicy, Stack } from "aws-cdk-lib";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import {
  Mapping,
  OnDemandFlow,
  S3InputFileType,
  S3Source,
  HubSpotDestination,
  HubSpotConnectorProfile,
  WriteOperationType,
  HubSpotApiVersion,
} from "../../src";

const app = new App({
  treeMetadata: false,
});

const stack = new Stack(app, "TestStack");
const secret = Secret.fromSecretNameV2(stack, "TestSecret", "appflow/hubspot");

const sourceBucket = new Bucket(stack, "TestSourceBucket", {
  autoDeleteObjects: true,
  removalPolicy: RemovalPolicy.DESTROY,
});

const deployment = new BucketDeployment(stack, "TestDeployment", {
  sources: [
    Source.jsonData("init.json", {
      annualrevenue: "1000000",
      description: "Sample Corp",
      domain: "sample.corp",
      industry: "INTERNET",
      name: "sample",
      website: "sample.corp",
    }),
  ],
  destinationBucket: sourceBucket,
  destinationKeyPrefix: "hubspot",
});

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

const source = new S3Source({
  bucket: sourceBucket,
  prefix: "hubspot",
  format: {
    type: S3InputFileType.JSON,
  },
});

const destination = new HubSpotDestination({
  profile: profile,
  apiVersion: HubSpotApiVersion.V3,
  entity: ["company"],
  operation: { type: WriteOperationType.INSERT },
  errorHandling: {
    errorLocation: {
      bucket: sourceBucket,
      prefix: "error",
    },
  },
});

const flow = new OnDemandFlow(stack, "OnDemandFlow", {
  source: source,
  destination: destination,
  mappings: [Mapping.mapAll()],
});

flow.node.addDependency(deployment);

app.synth();
