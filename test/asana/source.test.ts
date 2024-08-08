/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Stack } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import {
  AsanaConnectorProfile,
  AsanaSource,
  AsanaConnectorType,
  OnDemandFlow,
  S3Destination,
  Mapping,
} from '../../src';

describe('AsanaSource', () => {

  test('Source with connector name', () => {
    const stack = new Stack(undefined, 'TestStack');
    const source = new AsanaSource({
      profile: AsanaConnectorProfile.fromConnectionProfileName(stack, 'TestProfile', 'dummy-profile'),
      object: 'workspace',
    });

    const destination = new S3Destination({
      location: { bucket: new Bucket(stack, 'TestBucket') },
    });

    new OnDemandFlow(stack, 'TestFlow', {
      source: source,
      destination: destination,
      mappings: [Mapping.mapAll()],
    });

    const expectedConnectorType = AsanaConnectorType.instance;
    expect(source.connectorType.asProfileConnectorLabel).toEqual(expectedConnectorType.asProfileConnectorLabel);
    expect(source.connectorType.asProfileConnectorType).toEqual(expectedConnectorType.asProfileConnectorType);
    expect(source.connectorType.asTaskConnectorOperatorOrigin).toEqual(expectedConnectorType.asTaskConnectorOperatorOrigin);
    expect(source.connectorType.isCustom).toEqual(expectedConnectorType.isCustom);
  });

  test('Source with connector Arn', () => {
    const stack = new Stack(undefined, 'TestStack');
    const source = new AsanaSource({
      profile: AsanaConnectorProfile.fromConnectionProfileArn(stack, 'TestProfile', 'arn:aws:appflow:region:account-id:connectorprofile/TestProfile'),
      object: 'workspace',
    });

    const destination = new S3Destination({
      location: { bucket: new Bucket(stack, 'TestBucket') },
    });

    new OnDemandFlow(stack, 'TestFlow', {
      source: source,
      destination: destination,
      mappings: [Mapping.mapAll()],
    });

    const expectedConnectorType = AsanaConnectorType.instance;
    expect(source.connectorType.asProfileConnectorLabel).toEqual(expectedConnectorType.asProfileConnectorLabel);
    expect(source.connectorType.asProfileConnectorType).toEqual(expectedConnectorType.asProfileConnectorType);
    expect(source.connectorType.asTaskConnectorOperatorOrigin).toEqual(expectedConnectorType.asTaskConnectorOperatorOrigin);
    expect(source.connectorType.isCustom).toEqual(expectedConnectorType.isCustom);
  });


});
