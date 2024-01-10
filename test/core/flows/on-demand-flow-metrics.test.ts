/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Alarm, Metric } from 'aws-cdk-lib/aws-cloudwatch';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import {
  OnDemandFlow,
  S3Source,
  S3Destination,
  Mapping,
} from '../../../src';

describe('OnDemandFlow metrics', () => {
  test('', () => {

    const stack = new Stack(undefined, 'TestStack');

    const bucket = new Bucket(stack, 'TestBucket');

    const source = new S3Source({
      bucket: bucket,
      prefix: 'account',
    });

    const destination = new S3Destination({
      location: { bucket, prefix: 'new-account' },
    });


    const flow = new OnDemandFlow(stack, 'OnDemandFlow', {
      source,
      destination,
      key: new Key(stack, 'TestKey'),
      mappings: [Mapping.mapAll()],
    });

    addAlarmForMetric(stack, flow.metricFlowExecutionsStarted(), 'FlowExecutionsStartedAlarm');
    addAlarmForMetric(stack, flow.metricFlowExecutionsFailed(), 'FlowExecutionsFailedAlarm');
    addAlarmForMetric(stack, flow.metricFlowExecutionsSucceeded(), 'FlowxecutionsSucceededAlarm');
    addAlarmForMetric(stack, flow.metricFlowExecutionTime(), 'FlowExecutionTimeAlarm');
    addAlarmForMetric(stack, flow.metricFlowExecutionRecordsProcessed(), 'FlowExecutionRecordsProcessedAlarm');

    const template = Template.fromStack(stack);

    template.resourceCountIs('AWS::CloudWatch::Alarm', 5);
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      MetricName: 'FlowExecutionsStarted',
      Namespace: 'AWS/AppFlow',
    });
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      MetricName: 'FlowExecutionsFailed',
      Namespace: 'AWS/AppFlow',
    });
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      MetricName: 'FlowExecutionsSucceeded',
      Namespace: 'AWS/AppFlow',
    });
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      MetricName: 'FlowExecutionTime',
      Namespace: 'AWS/AppFlow',
    });
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      MetricName: 'FlowExecutionRecordsProcessed',
      Namespace: 'AWS/AppFlow',
    });
  });
});

function addAlarmForMetric(stack: Stack, metric: Metric, name: string) {
  new Alarm(stack, name, {
    metric,
    threshold: 1000,
    evaluationPeriods: 2,
  });
}

