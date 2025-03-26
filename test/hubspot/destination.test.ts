/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { Bucket } from "aws-cdk-lib/aws-s3";
import {
  HubSpotApiVersion,
  HubSpotConnectorProfile,
  HubSpotConnectorType,
  HubSpotDestination,
  Mapping,
  OnDemandFlow,
  S3InputFileType,
  S3Source,
  WriteOperation,
} from "../../src";

describe("HubSpotDestination", () => {
  test("Destination with only connector name", () => {
    const stack = new Stack(undefined, "TestStack");
    const destination = new HubSpotDestination({
      profile: HubSpotConnectorProfile.fromConnectionProfileName(
        stack,
        "TestProfile",
        "dummy-profile",
      ),
      entity: ["company"],
      apiVersion: HubSpotApiVersion.V3,
      operation: WriteOperation.insert(),
    });

    const expectedConnectorType = HubSpotConnectorType.instance;
    expect(destination.connectorType.asProfileConnectorLabel).toEqual(
      expectedConnectorType.asProfileConnectorLabel,
    );
    expect(destination.connectorType.asProfileConnectorType).toEqual(
      expectedConnectorType.asProfileConnectorType,
    );
    expect(destination.connectorType.asTaskConnectorOperatorOrigin).toEqual(
      expectedConnectorType.asTaskConnectorOperatorOrigin,
    );
    expect(destination.connectorType.isCustom).toEqual(
      expectedConnectorType.isCustom,
    );
  });

  test("Destination in a Flow is in the stack", () => {
    const stack = new Stack(undefined, "TestStack");

    const s3Bucket = new Bucket(stack, "TestBucket", {});
    const source = new S3Source({
      bucket: s3Bucket,
      prefix: "",
      format: {
        type: S3InputFileType.JSON,
      },
    });

    const destination = new HubSpotDestination({
      profile: HubSpotConnectorProfile.fromConnectionProfileName(
        stack,
        "TestProfile",
        "dummy-profile",
      ),
      entity: ["association_label", "ticket", "contact"],
      apiVersion: HubSpotApiVersion.V4,
      operation: WriteOperation.insert(),
    });

    new OnDemandFlow(stack, "TestFlow", {
      source: source,
      destination: destination,
      mappings: [Mapping.mapAll()],
    });

    Template.fromStack(stack).hasResourceProperties("AWS::AppFlow::Flow", {
      DestinationFlowConfigList: [
        {
          ConnectorProfileName: "dummy-profile",
          ApiVersion: "v4",
          ConnectorType: "CustomConnector",
          DestinationConnectorProperties: {
            CustomConnector: {
              EntityName: "association_label/ticket/contact",
              WriteOperationType: "INSERT",
            },
          },
        },
      ],
      FlowName: "TestStackTestFlow32CDAF42",
      SourceFlowConfig: {
        ConnectorType: "S3",
        SourceConnectorProperties: {
          S3: {
            BucketName: {
              Ref: "TestBucket560B80BC",
            },
            BucketPrefix: "",
            S3InputFormatConfig: {
              S3InputFileType: "JSON",
            },
          },
        },
      },
      Tasks: [
        {
          ConnectorOperator: {
            S3: "NO_OP",
          },
          SourceFields: [],
          TaskProperties: [
            {
              Key: "EXCLUDE_SOURCE_FIELDS_LIST",
              Value: "[]",
            },
          ],
          TaskType: "Map_all",
        },
      ],
      TriggerConfig: {
        TriggerType: "OnDemand",
      },
    });
  });
});
