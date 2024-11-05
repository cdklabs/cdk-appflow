/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { Bucket } from "aws-cdk-lib/aws-s3";
import {
  OnEventFlow,
  SalesforceSource,
  EventBridgeDestination,
  EventSources,
  Mapping,
  SalesforceConnectorProfile,
  FlowStatus,
} from "../../../src";

describe("OnEventFlow", () => {
  test.each([
    {
      namedRules: true,
    },
    {
      namedRules: false,
    },
  ])(
    "autoactivated flow with status and deactivation listeners renders all the resources",
    ({ namedRules }) => {
      const stack = new Stack(undefined, "TestStack");
      const source = new SalesforceSource({
        profile: SalesforceConnectorProfile.fromConnectionProfileName(
          stack,
          "TestProfile",
          "appflow-tester",
        ),
        object: "AccountChangeEvent",
      });

      const bucket = new Bucket(stack, "TestBucket");

      const destination = new EventBridgeDestination({
        partnerBus: EventSources.salesforceEventSource("test"),
        errorHandling: { errorLocation: { bucket } },
      });

      const flow = new OnEventFlow(stack, "OnEventFlow", {
        source: source,
        destination: destination,
        mappings: [Mapping.mapAll()],
        status: FlowStatus.ACTIVE,
      });

      flow.onDeactivated(
        "OnDeactivated",
        namedRules
          ? {
              ruleName: "OnDeactivated",
            }
          : undefined,
      );

      flow.onStatus(
        "OnStatus",
        namedRules
          ? {
              ruleName: "OnStatus",
            }
          : undefined,
      );

      const template = Template.fromStack(stack);

      template.hasResource("AWS::AppFlow::Flow", {
        Properties: {
          DestinationFlowConfigList: [
            {
              ConnectorType: "EventBridge",
              DestinationConnectorProperties: {
                EventBridge: {
                  ErrorHandlingConfig: {
                    BucketName: {
                      Ref: "TestBucket560B80BC",
                    },
                  },
                  Object: {
                    "Fn::Join": [
                      "",
                      [
                        "aws.partner/appflow/salesforce.com/",
                        {
                          Ref: "AWS::AccountId",
                        },
                        "/test",
                      ],
                    ],
                  },
                },
              },
            },
          ],
          FlowName: "TestStackOnEventFlow4BA4B0C6",
          FlowStatus: "Active",
          SourceFlowConfig: {
            ConnectorProfileName: "appflow-tester",
            ConnectorType: "Salesforce",
            SourceConnectorProperties: {
              Salesforce: {
                Object: "AccountChangeEvent",
              },
            },
          },
          Tasks: [
            {
              ConnectorOperator: {
                Salesforce: "NO_OP",
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
            TriggerType: "Event",
          },
        },
        DependsOn: ["TestBucketPolicyBA12ED38", "TestBucket560B80BC"],
      });

      template.resourceCountIs("AWS::Events::Rule", 2);

      template.hasResourceProperties("AWS::Events::Rule", {
        EventPattern: {
          source: ["aws.appflow"],
          resources: [
            {
              "Fn::GetAtt": ["OnEventFlowF92CD86B", "FlowArn"],
            },
          ],
          "detail-type": ["AppFlow Event Flow Report"],
        },
        State: "ENABLED",
      });

      template.hasResourceProperties("AWS::Events::Rule", {
        EventPattern: {
          source: ["aws.appflow"],
          resources: [
            {
              "Fn::GetAtt": ["OnEventFlowF92CD86B", "FlowArn"],
            },
          ],
          "detail-type": ["AppFlow Event Flow Deactivated"],
        },
        State: "ENABLED",
      });
    },
  );

  test("autoactivated flow without status and deactivation listeners renders flow definition only", () => {
    const stack = new Stack(undefined, "TestStack");
    const source = new SalesforceSource({
      profile: SalesforceConnectorProfile.fromConnectionProfileName(
        stack,
        "TestProfile",
        "appflow-tester",
      ),
      object: "AccountChangeEvent",
    });

    const bucket = new Bucket(stack, "TestBucket");

    const destination = new EventBridgeDestination({
      partnerBus: EventSources.salesforceEventSource("test"),
      errorHandling: { errorLocation: { bucket } },
    });

    new OnEventFlow(stack, "OnEventFlow", {
      source: source,
      destination: destination,
      mappings: [Mapping.mapAll()],
      status: FlowStatus.SUSPENDED,
    });

    const template = Template.fromStack(stack);

    template.hasResource("AWS::AppFlow::Flow", {
      Properties: {
        FlowStatus: "Suspended",
        DestinationFlowConfigList: [
          {
            ConnectorType: "EventBridge",
            DestinationConnectorProperties: {
              EventBridge: {
                ErrorHandlingConfig: {
                  BucketName: {
                    Ref: "TestBucket560B80BC",
                  },
                },
                Object: {
                  "Fn::Join": [
                    "",
                    [
                      "aws.partner/appflow/salesforce.com/",
                      {
                        Ref: "AWS::AccountId",
                      },
                      "/test",
                    ],
                  ],
                },
              },
            },
          },
        ],
        FlowName: "TestStackOnEventFlow4BA4B0C6",
        SourceFlowConfig: {
          ConnectorProfileName: "appflow-tester",
          ConnectorType: "Salesforce",
          SourceConnectorProperties: {
            Salesforce: {
              Object: "AccountChangeEvent",
            },
          },
        },
        Tasks: [
          {
            ConnectorOperator: {
              Salesforce: "NO_OP",
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
          TriggerType: "Event",
        },
      },
      DependsOn: ["TestBucketPolicyBA12ED38", "TestBucket560B80BC"],
    });

    template.resourceCountIs("AWS::Events::Rule", 0);
    template.resourceCountIs("AWS::Custom", 0);
  });
});
