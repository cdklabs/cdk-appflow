/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnFlow } from "aws-cdk-lib/aws-appflow";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { IConstruct } from "constructs";
import { S3ConnectorType } from "./type";
import { AppFlowPermissionsManager } from "../core/appflow-permissions-manager";
import { ConnectorType } from "../core/connectors/connector-type";
import { IFlow } from "../core/flows";
import { ISource } from "../core/vertices/source";

/**
 * The file type that Amazon AppFlow gets from your Amazon S3 bucket.
 */
export enum S3InputFileType {
  CSV = "CSV",
  JSON = "JSON",
}

export interface S3InputFormat {
  readonly type: S3InputFileType;
}

export interface S3SourceProps {
  readonly bucket: IBucket;
  readonly prefix: string;
  readonly format?: S3InputFormat;
}

export class S3Source implements ISource {
  public readonly connectorType: ConnectorType = S3ConnectorType.instance;

  constructor(private readonly props: S3SourceProps) {}

  bind(scope: IFlow): CfnFlow.SourceFlowConfigProperty {
    this.tryAddNodeDependency(scope, this.props.bucket);
    AppFlowPermissionsManager.instance().grantBucketRead(this.props.bucket);

    return {
      connectorType: this.connectorType.asProfileConnectorType,
      sourceConnectorProperties: this.buildSourceConnectorProperties(),
    };
  }

  private buildSourceConnectorProperties(): CfnFlow.SourceConnectorPropertiesProperty {
    return {
      s3: {
        bucketName: this.props.bucket.bucketName,
        bucketPrefix: this.props.prefix,
        s3InputFormatConfig: this.props.format && {
          s3InputFileType: this.props.format.type,
        },
      },
    };
  }

  private tryAddNodeDependency(
    scope: IConstruct,
    resource?: IConstruct | string,
  ): void {
    if (resource && typeof resource !== "string") {
      scope.node.addDependency(resource);
    }
  }
}
