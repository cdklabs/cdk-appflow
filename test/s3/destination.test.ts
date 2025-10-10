/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Database } from "@aws-cdk/aws-glue-alpha";
import { Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { Bucket } from "aws-cdk-lib/aws-s3";
import {
  OnDemandFlow,
  S3Destination,
  Mapping,
  S3Source,
  S3ConnectorType,
  S3OutputAggregationType,
  S3OutputFileType,
  S3OutputFilePrefixHierarchy,
  S3OutputFilePrefixFormat,
  S3OutputFilePrefixType,
} from "../../src";

describe("S3Destination", () => {
  test("Destination", () => {
    const stack = new Stack(undefined, "TestStack");

    const bucket = new Bucket(stack, "TestBucket", {
      bucketName: "test-bucket",
    });

    const source = new S3Source({
      bucket: bucket,
      prefix: "prefix",
    });

    const destination = new S3Destination({
      location: {
        bucket,
      },
      formatting: {
        fileType: S3OutputFileType.PARQUET,
        filePrefix: {
          type: S3OutputFilePrefixType.FILENAME,
          hierarchy: [
            S3OutputFilePrefixHierarchy.SCHEMA_VERSION,
            S3OutputFilePrefixHierarchy.EXECUTION_ID,
          ],
        },
        aggregation: { type: S3OutputAggregationType.NONE },
        preserveSourceDataTypes: true,
      },
      catalog: {
        database: new Database(stack, "TestDatabase", {
          databaseName: "testdb",
        }),
        tablePrefix: "db_prefix",
      },
    });

    new OnDemandFlow(stack, "TestFlow", {
      source: source,
      destination: destination,
      mappings: [Mapping.mapAll()],
    });

    const expectedConnectorType = S3ConnectorType.instance;
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

  test("Flow destination template is valid", () => {
    const stack = new Stack(undefined, "TestStack");

    const bucket = new Bucket(stack, "TestBucket", {
      bucketName: "test-bucket",
    });

    const source = new S3Source({
      bucket: bucket,
      prefix: "prefix",
    });

    const destination = new S3Destination({
      location: {
        bucket,
      },
      formatting: {
        fileType: S3OutputFileType.PARQUET,
        filePrefix: {
          type: S3OutputFilePrefixType.FILENAME,
          hierarchy: [
            S3OutputFilePrefixHierarchy.SCHEMA_VERSION,
            S3OutputFilePrefixHierarchy.EXECUTION_ID,
          ],
        },
        aggregation: { type: S3OutputAggregationType.NONE },
        preserveSourceDataTypes: true,
      },
      catalog: {
        database: new Database(stack, "TestDatabase", {
          databaseName: "testdb",
        }),
        tablePrefix: "db_prefix",
      },
    });

    new OnDemandFlow(stack, "TestFlow", {
      source: source,
      destination: destination,
      mappings: [Mapping.mapAll()],
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
              S3OutputFormatConfig: {
                AggregationConfig: {
                  AggregationType: "None",
                },
                FileType: "PARQUET",
                PrefixConfig: {
                  PathPrefixHierarchy: ["SCHEMA_VERSION", "EXECUTION_ID"],
                  PrefixType: "FILENAME",
                },
                PreserveSourceDataTyping: true,
              },
            },
          },
        },
      ],
      MetadataCatalogConfig: {
        GlueDataCatalog: {
          TablePrefix: "db_prefix",
        },
      },
    });
  });

  test("Only known S3OutputAggregationType specified", () => {
    const expectedTypes = ["None", "SingleFile"];
    const actualTypes = Object.values(S3OutputAggregationType);

    expect(actualTypes).toEqual(expectedTypes);
  });

  test("Only known S3OutputFileType specified", () => {
    const expectedTypes = ["CSV", "JSON", "PARQUET"];
    const actualTypes = Object.values(S3OutputFileType);

    expect(actualTypes).toEqual(expectedTypes);
  });

  test("Only known S3OutputFilePrefixHierarchy specified", () => {
    const expectedTypes = ["EXECUTION_ID", "SCHEMA_VERSION"];
    const actualTypes = Object.values(S3OutputFilePrefixHierarchy);

    expect(actualTypes).toEqual(expectedTypes);
  });

  test("Only known S3OutputFilePrefixFormat specified", () => {
    const expectedTypes = ["DAY", "HOUR", "MINUTE", "MONTH", "YEAR"];
    const actualTypes = Object.values(S3OutputFilePrefixFormat);

    expect(actualTypes).toEqual(expectedTypes);
  });

  test("Only known S3OutputFilePrefixType specified", () => {
    const expectedTypes = ["FILENAME", "PATH", "PATH_AND_FILE"];
    const actualTypes = Object.values(S3OutputFilePrefixType);

    expect(actualTypes).toEqual(expectedTypes);
  });
});
