/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { SecretValue, Stack } from 'aws-cdk-lib';
import {
  MailChimpConnectorProfile,
  MailChimpSource,
  MailChimpConnectorType,
  MailChimpApiVersion,
  OnDemandFlow,
  S3Destination,
  Mapping,
} from '../../src';
import { Bucket } from 'aws-cdk-lib/aws-s3';

describe('MailChimpSource', () => {

    test('Source with connector name', () => {
        const stack = new Stack(undefined, 'TestStack');
        const source = new MailChimpSource({
            profile: MailChimpConnectorProfile.fromConnectionProfileName(stack, 'TestProfile', 'dummy-profile'),
            apiVersion: MailChimpApiVersion.V3,
            object: "campaigns"
        });

        const destination = new S3Destination({
            location: { bucket: new Bucket(stack, 'TestBucket') },
        });
      
        new OnDemandFlow(stack, 'TestFlow', {
            source: source,
            destination: destination,
            mappings: [Mapping.mapAll()],
        });

        const expectedConnectorType = MailChimpConnectorType.instance;
        expect(source.connectorType.asProfileConnectorLabel).toEqual(expectedConnectorType.asProfileConnectorLabel);
        expect(source.connectorType.asProfileConnectorType).toEqual(expectedConnectorType.asProfileConnectorType);
        expect(source.connectorType.asTaskConnectorOperatorOrigin).toEqual(expectedConnectorType.asTaskConnectorOperatorOrigin);
        expect(source.connectorType.isCustom).toEqual(expectedConnectorType.isCustom);
    });

    test('Source with connector Arn', () => {
        const stack = new Stack(undefined, 'TestStack');
        const source = new MailChimpSource({
            profile: MailChimpConnectorProfile.fromConnectionProfileArn(stack, 'TestProfile', 'arn::aws::appflow::region-di:account-id:connectorprofile/TestProfile'),
            apiVersion: MailChimpApiVersion.V3,
            object: "campaigns"
        });

        const destination = new S3Destination({
            location: { bucket: new Bucket(stack, 'TestBucket') },
          });
      
        new OnDemandFlow(stack, 'TestFlow', {
            source: source,
            destination: destination,
            mappings: [Mapping.mapAll()],
        });

        const expectedConnectorType = MailChimpConnectorType.instance;
        expect(source.connectorType.asProfileConnectorLabel).toEqual(expectedConnectorType.asProfileConnectorLabel);
        expect(source.connectorType.asProfileConnectorType).toEqual(expectedConnectorType.asProfileConnectorType);
        expect(source.connectorType.asTaskConnectorOperatorOrigin).toEqual(expectedConnectorType.asTaskConnectorOperatorOrigin);
        expect(source.connectorType.isCustom).toEqual(expectedConnectorType.isCustom);
    });


});
