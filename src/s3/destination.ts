/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Database } from '@aws-cdk/aws-glue-alpha';
import { CfnFlow } from 'aws-cdk-lib/aws-appflow';
import { Effect, Policy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { IConstruct } from 'constructs';
import { S3ConnectorType } from './type';
import { AppFlowPermissionsManager } from '../core/appflow-permissions-manager';
import { ConnectorType } from '../core/connectors/connector-type';
import { FlowType, IFlow } from '../core/flows';
import { S3Location } from '../core/s3-location';
import { IDestination } from '../core/vertices/destination';

export interface S3FileAggregation {
  readonly type?: S3OutputAggregationType;
  /**
   * The maximum size, in MB, of the file containing portion of incoming data
   */
  readonly fileSize?: number;
};

export interface S3OutputFilePrefix {
  readonly hierarchy?: S3OutputFilePrefixHierarchy[];
  readonly format?: S3OutputFilePrefixFormat;
  readonly type?: S3OutputFilePrefixType;
};

export interface S3OutputFormatting {
  readonly aggregation?: S3FileAggregation;
  readonly fileType?: S3OutputFileType;
  readonly filePrefix?: S3OutputFilePrefix;
  readonly preserveSourceDataTypes?: boolean;
}

export enum S3OutputAggregationType {
  NONE = 'None',
  SINGLE_FILE = 'SingleFile'
}

export enum S3OutputFileType {
  CSV = 'CSV',
  JSON = 'JSON',
  PARQUET = 'PARQUET'
}

export enum S3OutputFilePrefixHierarchy {
  EXECUTION_ID = 'EXECUTION_ID',
  SCHEMA_VERSION = 'SCHEMA_VERSION'
}

export enum S3OutputFilePrefixFormat {
  DAY = 'DAY',
  HOUR = 'HOUR',
  MINUTE = 'MINUTE',
  MONTH = 'MONTH',
  YEAR = 'YEAR'
}

export enum S3OutputFilePrefixType {
  FILENAME = 'FILENAME',
  PATH = 'PATH',
  PATH_AND_FILE = 'PATH_AND_FILE'
}

export interface S3Catalog {
  readonly database: Database;
  readonly tablePrefix: string;
}

export interface S3DestinationProps {
  readonly location: S3Location;
  readonly catalog?: S3Catalog;
  readonly formatting?: S3OutputFormatting;
}

export class S3Destination implements IDestination {

  public readonly connectorType: ConnectorType = S3ConnectorType.instance;

  private readonly compatibleFlows: FlowType[] = [FlowType.ON_DEMAND, FlowType.SCHEDULED];

  constructor(private readonly props: S3DestinationProps) { }

  private buildAggregationConfig(aggregation?: S3FileAggregation) {
    return aggregation && {
      aggregationType: aggregation.type,
      // TODO: make sure it should use mebibytes
      targetFileSize: aggregation.fileSize && aggregation.fileSize,
    };
  }

  private buildPrefixConfig(filePrefix?: S3OutputFilePrefix) {
    return filePrefix && {
      pathPrefixHierarchy: filePrefix.hierarchy,
      prefixFormat: filePrefix.format,
      prefixType: filePrefix.type,
    };
  }

  bind(flow: IFlow): CfnFlow.DestinationFlowConfigProperty {

    // TODO: make sure this even makes sense
    if (!this.compatibleFlows.includes(flow.type)) {
      throw new Error(`Flow of type ${flow.type} does not support S3 as a destination`);
    }

    this.tryAddNodeDependency(flow, this.props.location.bucket);
    AppFlowPermissionsManager.instance().grantBucketWrite(this.props.location.bucket);

    if (this.props.catalog) {

      const { role, policy } = this.buildRoleAndPolicyForCatalog(flow);

      this.tryAddNodeDependency(flow, this.props.catalog.database);
      this.tryAddNodeDependency(flow, role);
      this.tryAddNodeDependency(flow, policy);

      flow._addCatalog({
        glueDataCatalog: {
          databaseName: this.props.catalog.database.databaseName,
          tablePrefix: this.props.catalog.tablePrefix,
          roleArn: role.roleArn,
        },
      });
    }

    return {
      connectorType: this.connectorType.asProfileConnectorType,
      destinationConnectorProperties: this.buildDestinationConnectorProperties(),
    };
  }

  /**
   * see: https://docs.aws.amazon.com/appflow/latest/userguide/security_iam_id-based-policy-examples.html#security_iam_id-based-policy-examples-access-gdc
   * see: https://docs.aws.amazon.com/appflow/latest/userguide/security_iam_service-role-policies.html#access-gdc
   * @param flow
   * @returns a tuple consisting of a role for cataloguing with a specified policy
   */
  private buildRoleAndPolicyForCatalog(flow: IFlow) {
    const role = new Role(flow.stack, `${flow.node.id}GlueAccessRole`, {
      assumedBy: new ServicePrincipal('appflow.amazonaws.com'),
    });

    const policy = new Policy(flow.stack, `${flow.node.id}GlueAccessRolePolicy`, {
      roles: [role],
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            'glue:BatchCreatePartition',
            'glue:CreatePartitionIndex',
            'glue:DeleteDatabase',
            'glue:GetTableVersions',
            'glue:GetPartitions',
            'glue:BatchDeletePartition',
            'glue:DeleteTableVersion',
            'glue:UpdateTable',
            'glue:DeleteTable',
            'glue:DeletePartitionIndex',
            'glue:GetTableVersion',
            'glue:CreatePartition',
            'glue:UntagResource',
            'glue:UpdatePartition',
            'glue:TagResource',
            'glue:UpdateDatabase',
            'glue:CreateTable',
            'glue:BatchUpdatePartition',
            'glue:GetTables',
            'glue:BatchGetPartition',
            'glue:GetDatabases',
            'glue:GetPartitionIndexes',
            'glue:GetTable',
            'glue:GetDatabase',
            'glue:GetPartition',
            'glue:CreateDatabase',
            'glue:BatchDeleteTableVersion',
            'glue:BatchDeleteTable',
            'glue:DeletePartition',
          ],
          resources: ['*'],
        }),
      ],
    });
    return { role, policy };
  }

  private buildDestinationConnectorProperties(): CfnFlow.DestinationConnectorPropertiesProperty {
    const bucketName = this.props.location.bucket.bucketName;

    if (!bucketName) {
      throw new Error('bucketName is required');
    }

    return {
      s3: {
        bucketName: bucketName,
        bucketPrefix: this.props.location.prefix,
        s3OutputFormatConfig: this.props.formatting && {
          aggregationConfig: this.buildAggregationConfig(this.props.formatting.aggregation),
          fileType: this.props.formatting.fileType ?? S3OutputFileType.JSON,
          prefixConfig: this.buildPrefixConfig(this.props.formatting.filePrefix),
          preserveSourceDataTyping: this.props.formatting.preserveSourceDataTypes,
        },
      },
    };
  }

  private tryAddNodeDependency(scope: IConstruct, resource?: IConstruct | string) {
    if (resource && typeof resource !== 'string') {
      scope.node.addDependency(resource);
    }
  }
}