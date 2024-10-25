/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { IBucket } from "aws-cdk-lib/aws-s3";

export interface S3Location {
  readonly bucket: IBucket;
  readonly prefix?: string;
}
