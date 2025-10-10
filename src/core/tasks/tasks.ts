/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnFlow } from "aws-cdk-lib/aws-appflow";
import { ConnectorType } from "../connectors/connector-type";
import { IFlow } from "../flows";
import { ISource } from "../vertices/source";

/**
 * A representation of a unitary action on the record fields
 */
export interface ITask {
  bind(flow: IFlow, source: ISource): CfnFlow.TaskProperty;
}

export interface TaskProperty {
  readonly key: string;
  readonly value: string;
}

/**
 * A pair that represents the (typically source) connector, and a task operation to be performed in the context of the connector
 */
export interface TaskConnectorOperator {
  readonly type?: ConnectorType;
  readonly operation: string;
}

/**
 * A representation of a unitary action on the record fields
 */
export class Task implements ITask {
  constructor(
    protected type: string,
    protected sourceFields: string[],
    protected connectorOperator: TaskConnectorOperator,
    protected properties: TaskProperty[],
    protected destinationField?: string,
  ) {}

  public bind(_flow: IFlow, source: ISource): CfnFlow.TaskProperty {
    return {
      taskType: this.type,
      sourceFields: this.sourceFields,
      taskProperties: this.properties.map(({ key, value }) => ({
        key: key,
        value: value,
      })),
      connectorOperator: this.buildOperatorFor(source),
      destinationField: this.destinationField,
    };
  }

  private buildOperatorFor(source: ISource): CfnFlow.ConnectorOperatorProperty {
    const operator: { [key: string]: string } = {};
    const origin =
      this.connectorOperator.type?.asTaskConnectorOperatorOrigin ??
      source.connectorType.asTaskConnectorOperatorOrigin;
    operator[origin] = this.connectorOperator.operation;
    return operator;
  }
}
