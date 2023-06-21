/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { OnEventOptions, Rule } from 'aws-cdk-lib/aws-events';
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { FlowBase, FlowBaseProps, FlowProps, IFlow } from './flow-base';

export interface TriggeredFlowBaseProps extends FlowProps {
  readonly autoActivate?: boolean;
}

export abstract class TriggeredFlowBase extends FlowBase implements IFlow {

  constructor(scope: Construct, id: string, props: FlowBaseProps, autoActivate?: boolean) {
    super(scope, id, props);

    if (autoActivate) {
      const activatorId = `${id}Activator`;

      // TODO: this is too basic. test it more to identify any potential errors/issues
      const activator = new AwsCustomResource(scope, activatorId, {
        onCreate: {
          service: 'Appflow',
          action: 'startFlow',
          parameters: {
            flowName: this.name,
          },
          physicalResourceId: PhysicalResourceId.of(activatorId),
        },
        onDelete: {
          service: 'Appflow',
          action: 'stopFlow',
          parameters: {
            flowName: this.name,
          },
        },
        policy: AwsCustomResourcePolicy.fromSdkCalls({
          resources: AwsCustomResourcePolicy.ANY_RESOURCE,
        }),
      });

      activator.node.addDependency(this);
    }
  }

  public abstract onDeactivated(id: string, options?: OnEventOptions): Rule;
}
