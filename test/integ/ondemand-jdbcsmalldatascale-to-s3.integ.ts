/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { App, RemovalPolicy, Stack, Token } from "aws-cdk-lib";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import {
  JdbcSmallDataScaleConnectorProfile,
  JdbcDriver,
  JdbcSmallDataScaleSource,
  S3Destination,
  OnDemandFlow,
  Mapping,
} from "../../src";

const app = new App({
  treeMetadata: false,
});

const stack = new Stack(app, "TestStack");

const secret = Secret.fromSecretNameV2(
  stack,
  "TestSecret",
  "appflow/rdspostgres",
);

const profile = new JdbcSmallDataScaleConnectorProfile(
  stack,
  "TestConnectorProfile",
  {
    basicAuth: {
      username: secret.secretValueFromJson("username").toString(),
      password: secret.secretValueFromJson("password"),
    },
    hostname: secret.secretValueFromJson("hostname").toString(),
    port: Token.asNumber(secret.secretValueFromJson("port").toString()),
    database: secret.secretValueFromJson("database").toString(),
    driver: secret.secretValueFromJson("driver").toString() as JdbcDriver,
  },
);

const source = new JdbcSmallDataScaleSource({
  profile,
  object: {
    schema: secret.secretValueFromJson("schema").toString(),
    table: secret.secretValueFromJson("table").toString(),
  },
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
