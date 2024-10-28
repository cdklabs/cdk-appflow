/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnFlow } from "aws-cdk-lib/aws-appflow";
import { IVertex } from "./vertex";
import { IFlow } from "../flows";

/**
 * A source of an AppFlow flow
 */
export interface ISource extends IVertex {
  bind(scope: IFlow): CfnFlow.SourceFlowConfigProperty;
}
