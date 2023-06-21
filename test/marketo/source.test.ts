/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Bucket } from 'aws-cdk-lib/aws-s3';

import {
  Mapping,
  MarketoConnectorProfile,
  MarketoConnectorType,
  MarketoInstanceUrlBuilder,
  MarketoSource,
  OnDemandFlow,
  S3Destination,
} from '../../src';

describe('MarketoSource', () => {

  test('Source with only connector name', () => {
    const stack = new Stack(undefined, 'TestStack');
    const source = new MarketoSource({
      profile: MarketoConnectorProfile.fromConnectionProfileName(stack, 'TestProfile', 'dummy-profile'),
      object: 'dummy-object',
    });

    const expectedConnectorType = MarketoConnectorType.instance;
    expect(source.connectorType.asProfileConnectorLabel).toEqual(expectedConnectorType.asProfileConnectorLabel);
    expect(source.connectorType.asProfileConnectorType).toEqual(expectedConnectorType.asProfileConnectorType);
    expect(source.connectorType.asTaskConnectorOperatorOrigin).toEqual(expectedConnectorType.asTaskConnectorOperatorOrigin);
    expect(source.connectorType.isCustom).toEqual(expectedConnectorType.isCustom);
  });

  test('Source in a Flow is in the stack', () => {
    const stack = new Stack(undefined, 'TestStack');
    const source = new MarketoSource({
      profile: MarketoConnectorProfile.fromConnectionProfileName(stack, 'TestProfile', 'dummy-profile'),
      object: 'dummy-object',
    });

    const destination = new S3Destination({
      location: { bucket: new Bucket(stack, 'TestBucket') },
    });

    new OnDemandFlow(stack, 'TestFlow', {
      source: source,
      destination: destination,
      mappings: [Mapping.mapAll()],
    });

    Template.fromStack(stack).hasResourceProperties('AWS::AppFlow::Flow', {
      SourceFlowConfig: {
        ConnectorProfileName: 'dummy-profile',
        ConnectorType: 'Marketo',
        SourceConnectorProperties: {
          Marketo: {
            Object: 'dummy-object',
          },
        },
      },
    });
  });

  test('Source for dummy-profile in a Flow is in the stack', () => {
    const stack = new Stack(undefined, 'TestStack');

    const profile = new MarketoConnectorProfile(stack, 'TestProfile', {
      oAuth: {
        accessToken: 'accessToken',
        flow: {
          clientCredentials: {
            clientId: 'clientId',
            clientSecret: 'clientSecret',
          },
        },
      },
      instanceUrl: MarketoInstanceUrlBuilder.buildFromAccount('marketoAccount'),
    });

    const source = new MarketoSource({
      profile: profile,
      object: 'dummy-object',
    });

    const destination = new S3Destination({
      location: { bucket: new Bucket(stack, 'TestBucket') },
    });

    new OnDemandFlow(stack, 'TestFlow', {
      source: source,
      destination: destination,
      mappings: [Mapping.mapAll()],
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::AppFlow::ConnectorProfile', {
      ConnectionMode: 'Public',
      ConnectorProfileName: 'TestProfile',
      ConnectorType: 'Marketo',
      ConnectorProfileConfig: {
        ConnectorProfileCredentials: {
          Marketo: {
            AccessToken: 'accessToken',
            ClientId: 'clientId',
            ClientSecret: 'clientSecret',
          },
        },
        ConnectorProfileProperties: {
          Marketo: {
            InstanceUrl: 'https://marketoAccount.mktorest.com',
          },
        },
      },
    });

    template.hasResource('AWS::AppFlow::Flow', {
      Properties: {
        SourceFlowConfig: {
          ConnectorProfileName: 'TestProfile',
          ConnectorType: 'Marketo',
          SourceConnectorProperties: {
            Marketo: {
              Object: 'dummy-object',
            },
          },
        },
      },
      DependsOn: [
        'TestBucketPolicyBA12ED38',
        'TestBucket560B80BC',
        'TestProfile45C36389',
      ],
    });
  });

});