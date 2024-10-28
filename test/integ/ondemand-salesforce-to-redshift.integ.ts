/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Cluster, Table } from "@aws-cdk/aws-redshift-alpha";
import { App, RemovalPolicy, Stack } from "aws-cdk-lib";
import { Vpc } from "aws-cdk-lib/aws-ec2";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import {
  Mapping,
  OnDemandFlow,
  RedshiftConnectorProfile,
  RedshiftDestination,
  SalesforceConnectorProfile,
  SalesforceSource,
} from "../../src";

const app = new App({
  treeMetadata: false,
});

const stack = new Stack(app, "TestStack");

const creds = Secret.fromSecretNameV2(
  stack,
  "TestSecret",
  "appflow/salesforce",
);

const profile = new SalesforceConnectorProfile(stack, "TestProfile", {
  oAuth: {
    accessToken: creds.secretValueFromJson("accessToken"),
  },
  instanceUrl: creds.secretValueFromJson("instanceUrl").toString(),
  isSandbox: false,
});

const source = new SalesforceSource({
  profile: profile,
  object: "Contact",
});

const bucket = new Bucket(stack, "TestBucket", {
  autoDeleteObjects: true,
  removalPolicy: RemovalPolicy.DESTROY,
});

const materUserName = "admin";
const databaseName = "workshop";

const cluster = new Cluster(stack, "TestCluster", {
  encrypted: false,
  masterUser: {
    masterUsername: materUserName,
  },
  defaultDatabaseName: databaseName,
  vpc: new Vpc(stack, "TestVpc"),
  removalPolicy: RemovalPolicy.DESTROY,
});

const table = new Table(stack, "TestTable", {
  tableName: "contact",
  tableColumns: [{ name: "name", dataType: "character varying" }],
  cluster: cluster,
  databaseName: databaseName,
  removalPolicy: RemovalPolicy.DESTROY,
});

const redshiftProfile = new RedshiftConnectorProfile(
  stack,
  "TestRedshiftProfile",
  {
    basicAuth: {
      username: materUserName,
    },
    intermediateLocation: { bucket, prefix: "intermediate" },
    cluster: cluster,
    databaseName: databaseName,
  },
);

const destination = new RedshiftDestination({
  profile: redshiftProfile,
  object: {
    table: table,
  },
});

new OnDemandFlow(stack, "SfdcToRedshiftELT", {
  source,
  destination,
  mappings: [
    Mapping.map(
      { name: "Name", dataType: "string" },
      { name: "name", dataType: "character varying" },
    ),
  ],
});

app.synth();
