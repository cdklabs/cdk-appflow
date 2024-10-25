/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { S3Location } from "./s3-location";

export interface ErrorHandlingConfiguration {
  readonly errorLocation?: S3Location;
  readonly failOnFirstError?: boolean;
}
