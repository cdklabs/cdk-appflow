/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import * as path from 'path';
import { CustomResource, Stack, Token } from 'aws-cdk-lib';
import { Schedule } from 'aws-cdk-lib/aws-events';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import * as api from './handler/api';

interface FlowTimeUpdaterProps {
  readonly schedule: Schedule;
  readonly startTime?: Date;
  readonly endTime?: Date;
}

export class FlowTimeUpdater extends Construct {
  public readonly scheduleExpression: string;
  public readonly startTime?: number;
  public readonly endTime?: number;

  constructor(scope: Construct, id: string, props: FlowTimeUpdaterProps) {
    super(scope, id);

    const resource = new CustomResource(this, 'Resource', {
      serviceToken: FlowTimeUpdaterProvider.getOrCreate(this),
      resourceType: 'Custom::FlowTimeUpdater',
      properties: {
        [api.PROP_SCHEDULE]: props.schedule.expressionString,
        [api.PROP_STARTTIME]: props.startTime && props.startTime.toISOString(),
        [api.PROP_ENDTIME]: props.endTime && props.endTime.toISOString(),
      },
    });

    this.scheduleExpression = resource.getAttString(api.ATTR_SCHEDULE);
    this.startTime = Token.asNumber(resource.getAtt(api.ATTR_STARTTIME));
    this.endTime = Token.asNumber(resource.getAtt(api.ATTR_ENDTIME));
  }
}

class FlowTimeUpdaterProvider extends Construct {

  /**
   * Returns the singleton provider.
   */
  public static getOrCreate(scope: Construct) {
    const stack = Stack.of(scope);
    const id = 'com.amazonaws.cdk.custom-resources.flow-time-provider';
    const x = stack.node.tryFindChild(id) as FlowTimeUpdaterProvider || new FlowTimeUpdaterProvider(stack, id);
    return x.provider.serviceToken;
  }

  private readonly provider: Provider;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.provider = new Provider(this, 'flow-time-provider', {
      onEventHandler: new Function(this, 'flow-time-on-event', {
        code: Code.fromAsset(path.join(__dirname, 'handler')),
        runtime: Runtime.NODEJS_16_X,
        handler: 'index.onEvent',
      }),
    });
  }
}