/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Database } from "@aws-cdk/aws-glue-alpha";
import { Stack } from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import { Role } from "aws-cdk-lib/aws-iam";
import { Bucket } from "aws-cdk-lib/aws-s3";
import {
  Mapping,
  OnDemandFlow,
  S3OutputAggregationType,
  S3Destination,
  S3OutputFileType,
  S3InputFileType,
  S3Source,
  S3OutputFilePrefixFormat,
  S3OutputFilePrefixHierarchy,
} from "../../src";

describe("S3 Flow tests", () => {
  test("Source and Destination with a bucket", () => {
    const stack = new Stack(undefined, undefined);
    const bucket = new Bucket(stack, "TestBucket", {
      bucketName: "test-bucket",
    });

    const source = new S3Source({
      bucket: bucket,
      prefix: "prefix",
    });

    const destination = new S3Destination({
      location: { bucket },
    });

    new OnDemandFlow(stack, "testFlow", {
      source: source,
      destination,
      mappings: [Mapping.mapAll()],
    });

    const template = Template.fromStack(stack);

    template.resourceCountIs("AWS::S3::Bucket", 1);
    template.resourceCountIs("AWS::AppFlow::Flow", 1);

    template.hasResourceProperties("AWS::AppFlow::Flow", {
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
      FlowName: "testFlow",
      SourceFlowConfig: {
        ConnectorType: "S3",
        SourceConnectorProperties: {
          S3: {
            BucketName: {
              Ref: "TestBucket560B80BC",
            },
            BucketPrefix: "prefix",
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

  test("Destination with complex formatting ", () => {
    const stack = new Stack(undefined, undefined);

    const bucket = Bucket.fromBucketName(stack, "TestBucket", "test-bucket");

    const source = new S3Source({
      bucket: bucket,
      prefix: "source-prefix",
      format: {
        type: S3InputFileType.JSON,
      },
    });

    const destination = new S3Destination({
      location: { bucket: bucket },
      formatting: {
        aggregation: {
          type: S3OutputAggregationType.SINGLE_FILE,
          fileSize: 1024,
        },
        fileType: S3OutputFileType.CSV,
        filePrefix: {
          hierarchy: [S3OutputFilePrefixHierarchy.SCHEMA_VERSION],
          format: S3OutputFilePrefixFormat.HOUR,
        },
      },
    });

    new OnDemandFlow(stack, "testFlow", {
      source: source,
      destination,
      mappings: [Mapping.mapAll({ exclude: ["field1", "field2"] })],
    });

    const template = Template.fromStack(stack);

    template.resourceCountIs("AWS::S3::Bucket", 0);
    template.resourceCountIs("AWS::AppFlow::Flow", 1);

    template.hasResourceProperties("AWS::AppFlow::Flow", {
      DestinationFlowConfigList: [
        {
          ConnectorType: "S3",
          DestinationConnectorProperties: {
            S3: {
              BucketName: "test-bucket",
              S3OutputFormatConfig: {
                AggregationConfig: {
                  AggregationType: "SingleFile",
                  TargetFileSize: 1024,
                },
                FileType: "CSV",
                PrefixConfig: {
                  PathPrefixHierarchy: ["SCHEMA_VERSION"],
                  PrefixFormat: "HOUR",
                },
              },
            },
          },
        },
      ],
      FlowName: "testFlow",
      SourceFlowConfig: {
        ConnectorType: "S3",
        SourceConnectorProperties: {
          S3: {
            BucketName: "test-bucket",
            BucketPrefix: "source-prefix",
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
              Value: '["field1","field2"]',
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

  test("Destination with catalog", () => {
    const stack = new Stack(undefined, undefined);

    const bucket = Bucket.fromBucketName(stack, "TestBucket", "test-bucket");

    const source = new S3Source({
      bucket: bucket,
      prefix: "source-prefix",
      format: {
        type: S3InputFileType.JSON,
      },
    });

    const destination = new S3Destination({
      location: { bucket: bucket },
      catalog: {
        database: new Database(stack, "TestDb", {
          databaseName: "testdb",
        }),
        tablePrefix: "tablePrefix",
      },
    });

    new OnDemandFlow(stack, "testFlow", {
      source: source,
      destination,
      mappings: [Mapping.mapAll({ exclude: ["field1", "field2"] })],
    });

    const template = Template.fromStack(stack);

    template.resourceCountIs("AWS::S3::Bucket", 0);

    template.resourceCountIs("AWS::AppFlow::Flow", 1);
    template.hasResourceProperties("AWS::AppFlow::Flow", {
      DestinationFlowConfigList: [
        {
          ConnectorType: "S3",
          DestinationConnectorProperties: {
            S3: {
              BucketName: "test-bucket",
            },
          },
        },
      ],
      MetadataCatalogConfig: {
        GlueDataCatalog: {
          DatabaseName: {
            Ref: "TestDb6EF03243",
          },
          RoleArn: {
            "Fn::GetAtt": ["testFlowGlueAccessRole34DC638A", "Arn"],
          },
          TablePrefix: "tablePrefix",
        },
      },
      FlowName: "testFlow",
      SourceFlowConfig: {
        ConnectorType: "S3",
        SourceConnectorProperties: {
          S3: {
            BucketName: "test-bucket",
            BucketPrefix: "source-prefix",
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
              Value: '["field1","field2"]',
            },
          ],
          TaskType: "Map_all",
        },
      ],
      TriggerConfig: {
        TriggerType: "OnDemand",
      },
    });

    template.resourceCountIs("AWS::IAM::Role", 1);
    template.hasResourceProperties("AWS::IAM::Role", {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: "sts:AssumeRole",
            Effect: "Allow",
            Principal: {
              Service: "appflow.amazonaws.com",
            },
          },
        ],
      },
    });

    template.resourceCountIs("AWS::IAM::Policy", 1);
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: [
          {
            Action: Match.arrayEquals([
              "glue:BatchCreatePartition",
              "glue:CreatePartitionIndex",
              "glue:DeleteDatabase",
              "glue:GetTableVersions",
              "glue:GetPartitions",
              "glue:BatchDeletePartition",
              "glue:DeleteTableVersion",
              "glue:UpdateTable",
              "glue:DeleteTable",
              "glue:DeletePartitionIndex",
              "glue:GetTableVersion",
              "glue:CreatePartition",
              "glue:UntagResource",
              "glue:UpdatePartition",
              "glue:TagResource",
              "glue:UpdateDatabase",
              "glue:CreateTable",
              "glue:BatchUpdatePartition",
              "glue:GetTables",
              "glue:BatchGetPartition",
              "glue:GetDatabases",
              "glue:GetPartitionIndexes",
              "glue:GetTable",
              "glue:GetDatabase",
              "glue:GetPartition",
              "glue:CreateDatabase",
              "glue:BatchDeleteTableVersion",
              "glue:BatchDeleteTable",
              "glue:DeletePartition",
            ]),
            Effect: "Allow",
            Resource: Match.arrayEquals([
              {
                "Fn::Join": [
                  "",
                  [
                    "arn:",
                    {
                      Ref: "AWS::Partition",
                    },
                    ":glue:",
                    { Ref: "AWS::Region" },
                    ":",
                    { Ref: "AWS::AccountId" },
                    ":catalog",
                  ],
                ],
              },
              {
                "Fn::Join": [
                  "",
                  [
                    "arn:",
                    {
                      Ref: "AWS::Partition",
                    },
                    ":glue:",
                    { Ref: "AWS::Region" },
                    ":",
                    { Ref: "AWS::AccountId" },
                    ":database/",
                    { Ref: "TestDb6EF03243" },
                  ],
                ],
              },
              {
                "Fn::Join": [
                  "",
                  [
                    "arn:",
                    {
                      Ref: "AWS::Partition",
                    },
                    ":glue:",
                    { Ref: "AWS::Region" },
                    ":",
                    { Ref: "AWS::AccountId" },
                    ":table/",
                    { Ref: "TestDb6EF03243" },
                    "/tablePrefix*",
                  ],
                ],
              },
            ]),
          },
        ],
      },
    });

    template.resourceCountIs("AWS::Glue::Database", 1);
  });

  test("Destination with catalog with custom role and imported values", () => {
    const stack = new Stack(undefined, undefined);

    const bucket = Bucket.fromBucketName(stack, "TestBucket", "test-bucket");
    const database = Database.fromDatabaseArn(
      stack,
      "TestDb",
      stack.formatArn({
        service: "glue",
        resource: "database",
        resourceName: "test-db",
      }),
    );
    const role = Role.fromRoleName(stack, "TestRole", "test-role");

    const source = new S3Source({
      bucket: bucket,
      prefix: "source-prefix",
      format: {
        type: S3InputFileType.JSON,
      },
    });

    const destination = new S3Destination({
      location: { bucket: bucket },
      catalog: {
        role,
        database,
        tablePrefix: "tablePrefix",
      },
    });

    new OnDemandFlow(stack, "testFlow", {
      source: source,
      destination,
      mappings: [Mapping.mapAll({ exclude: ["field1", "field2"] })],
    });

    const template = Template.fromStack(stack);

    template.resourceCountIs("AWS::S3::Bucket", 0);
    template.resourceCountIs("AWS::AppFlow::Flow", 1);
    template.resourceCountIs("AWS::IAM::Role", 0);
    template.resourceCountIs("AWS::Glue::Database", 0);

    template.hasResourceProperties("AWS::AppFlow::Flow", {
      DestinationFlowConfigList: [
        {
          ConnectorType: "S3",
          DestinationConnectorProperties: {
            S3: {
              BucketName: "test-bucket",
            },
          },
        },
      ],
      MetadataCatalogConfig: {
        GlueDataCatalog: {
          DatabaseName: "test-db",
          RoleArn: {
            "Fn::Join": [
              "",
              [
                "arn:",
                { Ref: "AWS::Partition" },
                ":iam::",
                { Ref: "AWS::AccountId" },
                ":role/test-role",
              ],
            ],
          },
          TablePrefix: "tablePrefix",
        },
      },
      FlowName: "testFlow",
      SourceFlowConfig: {
        ConnectorType: "S3",
        SourceConnectorProperties: {
          S3: {
            BucketName: "test-bucket",
            BucketPrefix: "source-prefix",
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
              Value: '["field1","field2"]',
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
