/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { App, RemovalPolicy, Stack } from "aws-cdk-lib";
import { Schedule } from "aws-cdk-lib/aws-events";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import {
  DataPullMode,
  Mapping,
  OnScheduleFlow,
  S3Destination,
  SalesforceMarketingCloudApiVersions,
  SalesforceMarketingCloudConnectorProfile,
  SalesforceMarketingCloudSource,
  Transform,
  Validation,
  ValidationAction,
  ValidationCondition,
} from "../../src";

const app = new App({
  treeMetadata: false,
});

const stack = new Stack(app, "TestStack", {
  env: {
    region: "eu-west-2",
  },
});

const secret = Secret.fromSecretNameV2(stack, "TestSecret", "sfmc/secret");

const profile = new SalesforceMarketingCloudConnectorProfile(
  stack,
  "TestConnector",
  {
    instanceUrl: secret.secretValueFromJson("instanceUrl").toString(),
    oAuth: {
      flow: {
        clientCredentials: {
          clientId: secret.secretValueFromJson("clientId"),
          clientSecret: secret.secretValueFromJson("clientSecret"),
        },
      },
      endpoints: {
        token: secret.secretValueFromJson("tokenUrl").toString(),
      },
    },
  },
);

const source = new SalesforceMarketingCloudSource({
  profile: profile,
  apiVersion: SalesforceMarketingCloudApiVersions.V1,
  object: "Email",
});

const bucket = new Bucket(stack, "TestBucket", {
  autoDeleteObjects: true,
  removalPolicy: RemovalPolicy.DESTROY,
});

const destination = new S3Destination({
  location: { bucket },
});

const flow = new OnScheduleFlow(stack, "OnScheduleFlow", {
  source: source,
  destination: destination,
  mappings: [
    Mapping.map(
      { name: "Name", dataType: "String" },
      { name: "Name", dataType: "string" },
    ),
  ],
  transforms: [Transform.mask({ name: "Name" }, "*")],
  validations: [
    Validation.when(
      ValidationCondition.isNull("Name"),
      ValidationAction.ignoreRecord(),
    ),
  ],
  schedule: Schedule.cron({ hour: "1", minute: "1" }),
  pullConfig: { mode: DataPullMode.INCREMENTAL },
  scheduleProperties: {
    startTime: new Date(Date.parse("2024-01-01")),
  },
});

flow.onRunStarted("OnRunStarted");

app.synth();
