/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { App, Stack, Token } from 'aws-cdk-lib';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import {
  AmazonRdsForPostgreSqlConnectorProfile,
  AmazonRdsForPostgreSqlDestination,
  JdbcDriver,
  JdbcSmallDataScaleConnectorProfile,
  JdbcSmallDataScaleSource,
  Mapping,
  OnDemandFlow,
} from '../../src';

const app = new App({
  treeMetadata: false,
});

const stack = new Stack(app, 'TestStack');

const secret = Secret.fromSecretNameV2(stack, 'TestSecret', 'appflow/rdspostgres');

const profile = new JdbcSmallDataScaleConnectorProfile(stack, 'JdbcSmallTestConnectorProfile', {
  basicAuth: {
    username: secret.secretValueFromJson('username').toString(),
    password: secret.secretValueFromJson('password'),
  },
  hostname: secret.secretValueFromJson('hostname').toString(),
  port: Token.asNumber(secret.secretValueFromJson('port').toString()),
  database: secret.secretValueFromJson('database').toString(),
  driver: secret.secretValueFromJson('driver').toString() as JdbcDriver,
});

const source = new JdbcSmallDataScaleSource({
  profile,
  object: {
    schema: secret.secretValueFromJson('schema').toString(),
    table: secret.secretValueFromJson('table').toString(),
  },
});

const destProfile = new AmazonRdsForPostgreSqlConnectorProfile(stack, 'AmazonRdsTestConnectorProfile', {
  basicAuth: {
    username: secret.secretValueFromJson('username').toString(),
    password: secret.secretValueFromJson('password'),
  },
  hostname: secret.secretValueFromJson('hostname').toString(),
  port: Token.asNumber(secret.secretValueFromJson('port').toString()),
  database: secret.secretValueFromJson('database').toString(),
});

const destination = new AmazonRdsForPostgreSqlDestination({
  profile: destProfile,
  object: {
    schema: secret.secretValueFromJson('schema').toString(),
    table: secret.secretValueFromJson('table').toString(),
  },
});

new OnDemandFlow(stack, 'OnDemandFlow', {
  source: source,
  destination: destination,
  mappings: [
    Mapping.map({ name: 'username' }, { name: 'username' }),
    Mapping.map({ name: 'password' }, { name: 'password' }),
    Mapping.map({ name: 'created_on' }, { name: 'created_on' }),
    Mapping.map({ name: 'email' }, { name: 'email' }),
  ],
});

app.synth();