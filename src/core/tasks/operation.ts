/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnFlow } from "aws-cdk-lib/aws-appflow";
import { ITask } from "./tasks";
import { IFlow } from "../flows/flow-base";
import { ISource } from "../vertices/source";

/**
 * A representation of a set of tasks that deliver complete operation
 */
export interface IOperation {
  bind(flow: IFlow, source: ISource): CfnFlow.TaskProperty[];
}

/**
 * A base class for all operations
 */
export abstract class OperationBase implements IOperation {
  constructor(private readonly tasks: ITask[]) {}

  public bind(flow: IFlow, source: ISource): CfnFlow.TaskProperty[] {
    return this.tasks.map((t) => t.bind(flow, source));
  }
}
