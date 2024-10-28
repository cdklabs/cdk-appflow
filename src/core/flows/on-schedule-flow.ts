/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { OnEventOptions, Schedule } from "aws-cdk-lib/aws-events";
import { Construct } from "constructs";
import {
  DataPullConfig,
  FlowType,
  IFlow,
  ScheduleProperties,
} from "./flow-base";
import {
  TriggeredFlowBase,
  TriggeredFlowBaseProps,
} from "./triggered-flow-base";

export interface OnScheduleFlowProps extends TriggeredFlowBaseProps {
  readonly schedule: Schedule;
  readonly pullConfig: DataPullConfig;
  readonly scheduleProperties?: ScheduleProperties;
}

export class OnScheduleFlow extends TriggeredFlowBase implements IFlow {
  constructor(scope: Construct, id: string, props: OnScheduleFlowProps) {
    super(scope, id, {
      ...props,
      type: FlowType.SCHEDULED,
      status: TriggeredFlowBase.setStatus(props.autoActivate, props.status),
      triggerConfig: {
        properties: {
          schedule: props.schedule,
          dataPullConfig: props.pullConfig,
          properties: props.scheduleProperties,
        },
      },
    });
  }

  public onDeactivated(id: string, options: OnEventOptions = {}) {
    const rule = this.onEvent(id, options);
    rule.addEventPattern({
      detailType: ["AppFlow Scheduled Flow Deactivated"],
    });
    return rule;
  }
}
