/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Duration, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { Schedule } from "aws-cdk-lib/aws-events";
import { Key } from "aws-cdk-lib/aws-kms";
import { Bucket } from "aws-cdk-lib/aws-s3";
import {
  S3Source,
  S3Destination,
  Mapping,
  OnScheduleFlow,
  DataPullMode,
} from "../../../src";

describe("OnScheduleFlow", () => {
  test("default", () => {
    const stack = new Stack(undefined, "TestStack");

    const bucket = new Bucket(stack, "TestBucket");

    const source = new S3Source({
      bucket: bucket,
      prefix: "account",
    });

    const destination = new S3Destination({
      location: { bucket, prefix: "new-account" },
    });

    new OnScheduleFlow(stack, "OnScheduleFlow", {
      source,
      destination,
      key: new Key(stack, "TestKey"),
      mappings: [Mapping.mapAll()],
      schedule: Schedule.rate(Duration.days(1)),
      pullConfig: {
        mode: DataPullMode.INCREMENTAL,
      },
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::AppFlow::Flow", {
      DestinationFlowConfigList: [
        {
          ConnectorType: "S3",
          DestinationConnectorProperties: {
            S3: {
              BucketName: {
                Ref: "TestBucket560B80BC",
              },
              BucketPrefix: "new-account",
            },
          },
        },
      ],
      FlowName: "TestStackOnScheduleFlow1BB655FE",
      SourceFlowConfig: {
        ConnectorType: "S3",
        SourceConnectorProperties: {
          S3: {
            BucketName: {
              Ref: "TestBucket560B80BC",
            },
            BucketPrefix: "account",
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
        TriggerType: "Scheduled",
        TriggerProperties: {
          DataPullMode: "Incremental",
        },
      },
      KMSArn: {
        "Fn::GetAtt": ["TestKey4CACAF33", "Arn"],
      },
    });
  });

  test("it passes offset", () => {
    const stack = new Stack(undefined, "TestStack");

    const bucket = new Bucket(stack, "TestBucket");

    const source = new S3Source({
      bucket: bucket,
      prefix: "account",
    });

    const destination = new S3Destination({
      location: { bucket, prefix: "new-account" },
    });

    new OnScheduleFlow(stack, "OnScheduleFlow", {
      source,
      destination,
      mappings: [Mapping.mapAll()],
      schedule: Schedule.rate(Duration.days(1)),
      pullConfig: {
        mode: DataPullMode.INCREMENTAL,
      },
      scheduleProperties: {
        offset: Duration.hours(1),
      },
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::AppFlow::Flow", {
      FlowName: "TestStackOnScheduleFlow1BB655FE",
      TriggerConfig: {
        TriggerType: "Scheduled",
        TriggerProperties: {
          DataPullMode: "Incremental",
          ScheduleOffset: 3600,
        },
      },
    });
  });
});
