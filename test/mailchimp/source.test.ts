/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Stack } from "aws-cdk-lib";
import { Bucket } from "aws-cdk-lib/aws-s3";
import {
  MailchimpConnectorProfile,
  MailchimpSource,
  MailchimpConnectorType,
  MailchimpApiVersion,
  OnDemandFlow,
  S3Destination,
  Mapping,
} from "../../src";

describe("MailchimpSource", () => {
  test("Source with connector name", () => {
    const stack = new Stack(undefined, "TestStack");
    const source = new MailchimpSource({
      profile: MailchimpConnectorProfile.fromConnectionProfileName(
        stack,
        "TestProfile",
        "dummy-profile",
      ),
      apiVersion: MailchimpApiVersion.V3,
      object: "campaigns",
    });

    const destination = new S3Destination({
      location: { bucket: new Bucket(stack, "TestBucket") },
    });

    new OnDemandFlow(stack, "TestFlow", {
      source: source,
      destination: destination,
      mappings: [Mapping.mapAll()],
    });

    const expectedConnectorType = MailchimpConnectorType.instance;
    expect(source.connectorType.asProfileConnectorLabel).toEqual(
      expectedConnectorType.asProfileConnectorLabel,
    );
    expect(source.connectorType.asProfileConnectorType).toEqual(
      expectedConnectorType.asProfileConnectorType,
    );
    expect(source.connectorType.asTaskConnectorOperatorOrigin).toEqual(
      expectedConnectorType.asTaskConnectorOperatorOrigin,
    );
    expect(source.connectorType.isCustom).toEqual(
      expectedConnectorType.isCustom,
    );
  });

  test("Source with connector Arn", () => {
    const stack = new Stack(undefined, "TestStack");
    const source = new MailchimpSource({
      profile: MailchimpConnectorProfile.fromConnectionProfileArn(
        stack,
        "TestProfile",
        "arn:aws:appflow:region:account-id:connectorprofile/TestProfile",
      ),
      apiVersion: MailchimpApiVersion.V3,
      object: "campaigns",
    });

    const destination = new S3Destination({
      location: { bucket: new Bucket(stack, "TestBucket") },
    });

    new OnDemandFlow(stack, "TestFlow", {
      source: source,
      destination: destination,
      mappings: [Mapping.mapAll()],
    });

    const expectedConnectorType = MailchimpConnectorType.instance;
    expect(source.connectorType.asProfileConnectorLabel).toEqual(
      expectedConnectorType.asProfileConnectorLabel,
    );
    expect(source.connectorType.asProfileConnectorType).toEqual(
      expectedConnectorType.asProfileConnectorType,
    );
    expect(source.connectorType.asTaskConnectorOperatorOrigin).toEqual(
      expectedConnectorType.asTaskConnectorOperatorOrigin,
    );
    expect(source.connectorType.isCustom).toEqual(
      expectedConnectorType.isCustom,
    );
  });
});
