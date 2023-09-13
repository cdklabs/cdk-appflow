/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Duration, IResource, Lazy, Resource } from 'aws-cdk-lib';
import { CfnFlow } from 'aws-cdk-lib/aws-appflow';

import { OnEventOptions, Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { Construct, IConstruct } from 'constructs';
import { FlowTimeUpdater } from './flow-time-updater';
import { ConnectorType } from '../connectors/connector-type';

import { IMapping, ITransform, IFilter, IValidation } from '../tasks';
import { IDestination } from '../vertices/destination';
import { ISource } from '../vertices/source';

export interface IFlow extends IResource {
  /**
   * The ARN of the flow.
   */
  readonly arn: string;

  /**
   * The name of the flow
   */
  readonly name: string;

  /**
   * The type of the flow.
   */
  readonly type: FlowType;

  onRunStarted(id: string, options?: OnEventOptions): Rule;

  onRunCompleted(id: string, options?: OnEventOptions): Rule;

  /**
   * @internal
   */
  _addMapping(mapping: IMapping): IFlow;

  /**
   * @internal
   */
  _addValidation(validator: IValidation): IFlow;

  /**
   * @internal
   */
  _addTransform(transform: ITransform): IFlow;

  /**
   * @internal
   */
  _addFilter(filter: IFilter): IFlow;

  /**
   * @internal
   */
  _addCatalog(metadata: CfnFlow.MetadataCatalogConfigProperty): void;
}

export enum FlowType {
  EVENT = 'Event',
  ON_DEMAND = 'OnDemand',
  SCHEDULED = 'Scheduled'
}

export enum FlowStatus {
  ACTIVE = 'Active',
  SUSPENDED = 'Suspended'
}

export enum DataPullMode {
  COMPLETE = 'Complete',
  INCREMENTAL = 'Incremental'
}

export interface DataPullConfig {
  readonly mode: DataPullMode;
  /**
   * The name of the field to use as a timestamp for recurring incremental flows.
   * The default field is set per particular @see ISource.
   */
  readonly timestampField?: string;
}

export interface ScheduleProperties {
  readonly startTime?: Date;
  readonly endTime?: Date;
  readonly offset?: Duration;
  /**
   * Timestamp for the records to import from the connector in the first flow run
   * @default 30 days back from the initial frow run
   */
  readonly firstExecutionFrom?: Date;
  readonly timezone?: string;
}

export interface TriggerProperties {
  readonly dataPullConfig: DataPullConfig;
  readonly schedule: Schedule;
  readonly properties?: ScheduleProperties;
  readonly flowErrorDeactivationThreshold?: number;
}

export interface TriggerConfig {
  readonly properties?: TriggerProperties;
}

export interface FlowProps {
  readonly name?: string;
  readonly description?: string;
  readonly source: ISource;
  readonly destination: IDestination;
  readonly mappings: IMapping[];
  readonly validations?: IValidation[];
  readonly transforms?: ITransform[];
  readonly filters?: IFilter[];
  readonly key?: IKey;
}

export interface FlowBaseProps extends FlowProps {
  readonly type: FlowType;
  readonly triggerConfig?: TriggerConfig;
  readonly status?: FlowStatus;
}

export abstract class FlowBase extends Resource implements IFlow {

  /**
   * The ARN of the flow.
   */
  public readonly arn: string;

  /**
   * The type of the flow.
   */
  public readonly type: FlowType;

  /**
   * The name of the flow.
   */
  public readonly name: string;

  private readonly mappings: CfnFlow.TaskProperty[] = [];
  private readonly validations: CfnFlow.TaskProperty[] = [];
  private readonly transforms: CfnFlow.TaskProperty[] = [];
  private readonly filters: CfnFlow.TaskProperty[] = [];
  private readonly source: ISource;
  private _catalogMetadata?: CfnFlow.MetadataCatalogConfigProperty;
  // TODO: make it optional.
  // That is: if somebody passess projection as a filter
  //          this should not be used.
  private _projectionFilter: CfnFlow.TaskProperty;

  constructor(scope: Construct, id: string, props: FlowBaseProps) {
    super(scope, id);

    this.type = props.type;

    this._projectionFilter = this.initProjectionFilter(props.source.connectorType);

    this.name = props.name || id;
    const resource = new CfnFlow(this, id, {
      flowName: this.name,
      flowStatus: props.status,
      triggerConfig: {
        triggerType: props.type,
        triggerProperties: props.triggerConfig
          && props.triggerConfig.properties
          && this.buildTriggerProperties(scope, id, props.triggerConfig.properties),
      },
      kmsArn: props.key?.keyArn,
      metadataCatalogConfig: Lazy.any({ produce: () => this._catalogMetadata }),
      description: props.description,
      sourceFlowConfig: {
        ...props.source.bind(this),
        incrementalPullConfig: this.buildIncrementalPullConfig(props.triggerConfig),
      },
      // NOTE: currently only a single destination is allowed with AppFlow
      //       it might require a change of approach in the future.
      destinationFlowConfigList: [props.destination.bind(this)],
      tasks: Lazy.any({
        produce: () => {
          const tasks = [
            ...this.mappings,
            ...this.transforms,
            ...this.filters,
            ...this.validations,
          ];

          // TODO: make sure that this.filters doesn't already have a projection definition
          if (this._projectionFilter.sourceFields.length > 0) {
            tasks.unshift(this._projectionFilter);
          }

          return tasks;
        },
      }),
    });

    this.arn = resource.attrFlowArn;
    this.source = props.source;

    props.mappings.forEach(m => this._addMapping(m));

    if (props.validations) {
      props.validations.forEach(v => this._addValidation(v));
    }

    if (props.transforms) {
      props.transforms.forEach(t => this._addTransform(t));
    }

    if (props.filters) {
      props.filters.forEach(f => this._addFilter(f));
    }

    this.node.addValidation({
      validate: () => this.mappings.length === 0 ? ['A Flow must have at least one mapping'] : [],
    });
  }

  private buildTriggerProperties(scope: IConstruct, id: string, props: TriggerProperties): CfnFlow.ScheduledTriggerPropertiesProperty {

    const updater = new FlowTimeUpdater(scope, `${id}Updater`, {
      schedule: props.schedule,
      startTime: props.properties?.startTime,
      endTime: props.properties?.endTime,
    });

    this.node.addDependency(updater);

    return {
      dataPullMode: props.dataPullConfig.mode,
      flowErrorDeactivationThreshold: props.flowErrorDeactivationThreshold,
      scheduleExpression: updater.scheduleExpression,
      firstExecutionFrom: props.properties?.firstExecutionFrom &&
        Math.floor(props.properties.firstExecutionFrom.getTime() / 1000),
      scheduleStartTime: props.properties?.startTime && updater.startTime,
      scheduleEndTime: props.properties?.endTime && updater.endTime,
    };
  }

  private initProjectionFilter(sourceType: ConnectorType): CfnFlow.TaskProperty {
    const filterConnectorOperator: { [key: string]: string } = {};
    filterConnectorOperator[sourceType.asTaskConnectorOperatorOrigin] = 'PROJECTION';

    return {
      taskType: 'Filter',
      connectorOperator: filterConnectorOperator,
      sourceFields: [],
    };
  }

  /**
     * Set the catalog definitionfor the flow
     *
     * @internal
     */
  public _addCatalog(metadata: CfnFlow.MetadataCatalogConfigProperty) {
    this._catalogMetadata = metadata;
  }

  /**
   *
   * @param validation
   * @returns the flow to which the validation was added
   *
   * @internal
   */
  public _addValidation(validation: IValidation): IFlow {
    this.validations.push(...validation.bind(this, this.source));
    return this;
  }

  /**
   *
   * @param mapping
   * @returns the flow to which the validation was added
   *
   * @internal
   */
  public _addMapping(mapping: IMapping): IFlow {
    const boundMappingTasks = mapping.bind(this, this.source);
    this.addProjectionField(boundMappingTasks);
    this.mappings.push(...boundMappingTasks);

    return this;
  }

  /**
   *
   * @param filter
   * @returns the flow to which the validation was added
   *
   * @internal
   */
  public _addFilter(filter: IFilter): IFlow {
    const boundFilterTasks = filter.bind(this, this.source);
    this.addProjectionField(boundFilterTasks);
    this.filters.push(...boundFilterTasks);
    return this;
  }

  /**
   *
   * @param transform
   * @returns the flow to which the validation was added
   *
   * @internal
   */
  public _addTransform(transform: ITransform): IFlow {
    this.transforms.push(...transform.bind(this, this.source));
    return this;
  }

  private addProjectionField(boundMappingTasks: CfnFlow.TaskProperty[]) {
    // TODO: test if this satisfies all the requirements.
    boundMappingTasks.forEach(boundMapping => {
      if (['Map', 'Filter'].includes(boundMapping.taskType)) {
        boundMapping.sourceFields.forEach(field => {
          if (!this._projectionFilter.sourceFields.includes(field)) {
            this._projectionFilter.sourceFields.push(field);
          }
        });
      }
    });
  }

  // see: https://docs.aws.amazon.com/appflow/latest/userguide/flow-notifications.html
  public onEvent(id: string, options: OnEventOptions = {}) {
    const rule = new Rule(this, id, options);
    rule.addEventPattern({
      source: ['aws.appflow'],
      resources: [this.arn],
    });
    rule.addTarget(options.target);
    return rule;
  }

  public onRunStarted(id: string, options: OnEventOptions = {}) {
    const rule = this.onEvent(id, options);
    rule.addEventPattern({
      detailType: ['AppFlow Start Flow Run Report'],
    });
    return rule;
  }

  public onRunCompleted(id: string, options: OnEventOptions = {}) {
    const rule = this.onEvent(id, options);
    rule.addEventPattern({
      detailType: ['AppFlow End Flow Run Report'],
    });
    return rule;
  }

  private buildIncrementalPullConfig(triggerConfig?: TriggerConfig): CfnFlow.IncrementalPullConfigProperty | undefined {
    return triggerConfig && triggerConfig.properties && triggerConfig.properties.dataPullConfig
      && triggerConfig.properties.dataPullConfig.timestampField
      ? {
        datetimeTypeFieldName: triggerConfig.properties.dataPullConfig.timestampField,
      }
      : undefined;
  }
}
