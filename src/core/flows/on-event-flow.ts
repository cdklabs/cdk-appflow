/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { OnEventOptions } from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
import { FlowType, IFlow } from './flow-base';
import { TriggeredFlowBase, TriggeredFlowBaseProps } from './triggered-flow-base';

export interface OnEventFlowProps extends TriggeredFlowBaseProps { }

export class OnEventFlow extends TriggeredFlowBase implements IFlow {

  constructor(scope: Construct, id: string, props: OnEventFlowProps) {
    super(scope, id, {
      ...props,
      type: FlowType.EVENT,
    }, props.autoActivate);
  }

  public onDeactivated(id: string, options: OnEventOptions = {}) {
    const rule = this.onEvent(id, options);
    rule.addEventPattern({
      detailType: ['AppFlow Event Flow Deactivated'],
    });
    return rule;
  }

  public onStatus(id: string, options: OnEventOptions = {}) {
    const rule = this.onEvent(id, options);
    rule.addEventPattern({
      detailType: ['AppFlow Event Flow Report'],
    });
    return rule;
  }
}
