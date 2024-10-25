/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { OnEventOptions, Rule } from "aws-cdk-lib/aws-events";
import { Construct } from "constructs";
import {
  FlowBase,
  FlowBaseProps,
  FlowProps,
  FlowStatus,
  IFlow,
} from "./flow-base";

export interface TriggeredFlowBaseProps extends FlowProps {
  /**
   * The status to set on the flow. Use this over {@link autoActivate}.
   */
  readonly status?: FlowStatus;
  /**
   * @deprecated. This property is deprecated and will be removed in a future release. Use {@link status} instead
   */
  readonly autoActivate?: boolean;
}

/**
 * A base class for triggered flows.
 */
export abstract class TriggeredFlowBase extends FlowBase implements IFlow {
  /**
   *
   * @param autoActivate - a boolean value indicating whether to automatically activate the flow.
   * @param status - a {@link FlowStatus} value indicating the status to set on the flow.
   * @returns
   */
  protected static setStatus(
    autoActivate?: boolean,
    status?: FlowStatus,
  ): FlowStatus | undefined {
    if (autoActivate !== undefined && status !== undefined) {
      throw new Error("Cannot specify both autoActivate and status");
    }

    return autoActivate !== undefined
      ? autoActivate
        ? FlowStatus.ACTIVE
        : FlowStatus.SUSPENDED
      : status !== undefined
        ? status
        : undefined;
  }
  /**
   *
   * @param scope
   * @param id
   * @param props
   */
  constructor(scope: Construct, id: string, props: FlowBaseProps) {
    super(scope, id, props);
  }

  public abstract onDeactivated(id: string, options?: OnEventOptions): Rule;
}
