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
  HubSpotSource,
  Mapping,
  OnDemandFlow,
  S3Destination,
} from "../../src";

describe("HubSpotSource", () => {
  test("Source with only connector name", () => {
    const stack = new Stack(undefined, "TestStack");
    const source = new HubSpotSource({
      profile: HubSpotConnectorProfile.fromConnectionProfileName(
        stack,
        "TestProfile",
        "dummy-profile",
      ),
      apiVersion: HubSpotApiVersion.V3,
      entity: ["company"],
    });

    const expectedConnectorType = HubSpotConnectorType.instance;
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

  test("Source in a Flow is in the stack", () => {
    const stack = new Stack(undefined, "TestStack");
    const source = new HubSpotSource({
      profile: HubSpotConnectorProfile.fromConnectionProfileName(
        stack,
        "TestProfile",
        "dummy-profile",
      ),
      apiVersion: HubSpotApiVersion.V3,
      entity: ["company"],
    });

    const destination = new S3Destination({
      location: { bucket: new Bucket(stack, "TestBucket") },
    });

    new OnDemandFlow(stack, "TestFlow", {
      source: source,
      destination: destination,
      mappings: [Mapping.mapAll()],
    });

    Template.fromStack(stack).hasResourceProperties("AWS::AppFlow::Flow", {
      DestinationFlowConfigList: [
        {
          ConnectorType: "S3",
          DestinationConnectorProperties: {
            S3: {
              BucketName: {
                Ref: "TestBucket560B80BC",
              },
            },
          },
        },
      ],
      FlowName: "TestStackTestFlow32CDAF42",
      SourceFlowConfig: {
        ApiVersion: "v3",
        ConnectorProfileName: "dummy-profile",
        ConnectorType: "CustomConnector",
        SourceConnectorProperties: {
          CustomConnector: {
            EntityName: "company",
          },
        },
      },
      Tasks: [
        {
          ConnectorOperator: {
            CustomConnector: "NO_OP",
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
