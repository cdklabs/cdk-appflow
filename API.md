# Amazon AppFlow Construct Library

*Note:* this library is currently in technical preview.

## Introduction

Amazon AppFlow is a service that enables creating managed, bi-directional data transfer integrations between various SaaS applications and AWS services.

For more information, see the [Amazon AppFlow User Guide](https://docs.aws.amazon.com/appflow/latest/userguide/what-is-appflow.html).

## Example

```ts
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { ISecret } from 'aws-cdk-lib/aws-secretsmanager';
import {
  ISource,
  IDestination,
  Filter,
  FilterCondition,
  Mapping,
  OnDemandFlow,
  S3Destination,
  SalesforceConnectorProfile,
  SalesforceSource,
  Transform,
  Validation,
  ValidationAction,
  ValidationCondition,
} from '@cdklabs/cdk-appflow';

declare const clientSecret: ISecret;
declare const accessToken: string;
declare const refreshToken: string;
declare const instanceUrl: string;

const profile = new SalesforceConnectorProfile(this, 'MyConnectorProfile', {
  oAuth: {
    accessToken: accessToken,
    flow: {
      refresTokenGrant: {
        refreshToken: refreshToken,
        client: clientSecret,
      },
    },
  },
  instanceUrl: instanceUrl,
  isSandbox: false,
});

const source = new SalesforceSource({
  profile: profile,
  object: 'Account',
});

const bucket = new Bucket(this, 'DestinationBucket');

const destination = new S3Destination({
  location: { bucket },
});

new OnDemandFlow(this, 'SfAccountToS3', {
  source: source,
  destination: destination,
  mappings: [Mapping.mapAll()],
  transforms: [
    Transform.mask({ name: 'Name' }, '*'),
  ],
  validations: [
    Validation.when(ValidationCondition.isNull('Name'), ValidationAction.ignoreRecord()),
  ],
  filters: [
    Filter.when(FilterCondition.timestampLessThanEquals({ name: 'LastModifiedDate', dataType: 'datetime' }, new Date(Date.parse('2022-02-02')))),
  ],
});

```
# Concepts

Amazon AppFlow introduces several concepts that abstract away the technicalities of setting up and managing data integrations.

An `Application` is any SaaS data integration component that can be either a *source* or a *destination* for Amazon AppFlow. A source is an application from which Amazon AppFlow will retrieve data, whereas a destination is an application to which Amazon AppFlow will send data.

A `Flow` is Amazon AppFlow's integration between a source and a destination.

A `ConnectorProfile` is Amazon AppFlow's abstraction over authentication/authorization with a particular SaaS application. The per-SaaS application permissions given to a particular `ConnectorProfile` will determine whether the connector profile can support the application as a source or as a destination (see whether a particular application is supported as either a source or a destination in [the documentation](https://docs.aws.amazon.com/appflow/latest/userguide/app-specific.html)).

## Types of Flows

The library introduces three, separate types of flows:

- `OnDemandFlow` - a construct representing a flow that can be triggered programmatically with the use of a [StartFlow API call](https://docs.aws.amazon.com/appflow/1.0/APIReference/API_StartFlow.html).

- `OnEventFlow` - a construct representing a flow that is triggered by a SaaS application event published to AppFlow. At the time of writing only a Salesforce source is able to publish events that can be consumed by AppFlow flows.

- `OnScheduleFlow` - a construct representing a flow that is triggered on a [`Schedule`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_events.Schedule.html)

## Tasks

Tasks are steps that can be taken upon fields. Tasks compose higher level objects that in this library are named `Operations`. There are four operations identified:

- Transforms - 1-1 transforms on source fields, like truncation or masking

- Mappings - 1-1 or many-to-1 operations from source fields to a destination field

- Filters - operations that limit the source data on a particular conditions

- Validations - operations that work on a per-record level and can have either a record-level consequence (i.e. dropping the record) or a global one (terminating the flow).

Each flow exposes dedicated properties to each of the operation types that one can use like in the example below:

```ts
import {
  Filter,
  FilterCondition,
  IDestination,
  ISource,
  Mapping,
  OnDemandFlow,
  S3Destination,
  SalesforceConnectorProfile,
  SalesforceSource,
  Transform,
  Validation,
  ValidationAction,
  ValidationCondition,
} from '@cdklabs/cdk-appflow';

declare const stack: Stack;
declare const source: ISource;
declare const destination: IDestination;

const flow = new OnDemandFlow(stack, 'OnDemandFlow', {
  source: source,
  destination: destination,
  transforms: [
    Transform.mask({ name: 'Name' }, '*'),
  ],
  mappings: [
    Mapping.map({ name: 'Name', dataType: 'String' }, { name: 'Name', dataType: 'string' }),
  ],
  filters: [
    Filter.when(FilterCondition.timestampLessThanEquals({ name: 'LastModifiedDate', dataType: 'datetime' }, new Date(Date.parse('2022-02-02')))),
  ],
  validations: [
    Validation.when(ValidationCondition.isNull('Name'), ValidationAction.ignoreRecord()),
  ]
});
```

## EventBridge notifications

Each flow publishes events to the default EventBridge bus:

- `onRunStarted`
- `onRunCompleted`
- `onDeactivated` (only for the `OnEventFlow` and the `OnScheduleFlow`)
- `onStatus` (only for the `OnEventFlow` )

This way one can consume the notifications as in the example below:

```ts
import { ITopic } from 'aws-cdk-lib/aws-sns';
import { SnsTopic } from 'aws-cdk-lib/aws-events-targets';
import { IFlow } from '@cdklabs/cdk-appflow';

declare const flow: IFlow;
declare const myTopic: ITopic;

flow.onRunCompleted('OnRunCompleted', {
    target: new SnsTopic(myTopic),
});
```

# Notable distinctions from CloudFormation specification

## `OnScheduleFlow` and `incrementalPullConfig`

In CloudFormation the definition of the `incrementalPullConfig` (which effectively gives a name of the field used for tracking the last pulled timestamp) is on the [`SourceFlowConfig`](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-appflow-flow-sourceflowconfig.html#cfn-appflow-flow-sourceflowconfig-incrementalpullconfig) property. In the library this has been moved to the `OnScheduleFlow` constructor properties.

## `S3Destination` and Glue Catalog

Although in CloudFormation the Glue Catalog configuration is settable on the flow level - it works only when the destination is S3. That is why the library shifts the Glue Catalog properties definition to the `S3Destination`, which in turn requires using Lazy for populating `metadataCatalogConfig` in the flow.

# Security considerations

It is *recommended* to follow [data protection mechanisms for Amazon AppFlow](https://docs.aws.amazon.com/appflow/latest/userguide/data-protection.html).

## Confidential information

Amazon AppFlow application integration is done using `ConnectionProfiles`. A `ConnectionProfile` requires providing sensitive information in the form of e.g. access and refresh tokens. It is *recommended* that such information is stored securely and passed to AWS CDK securely. All the sensitive fields are effectively `IResolvable` and this means they can be resolved at deploy time. With that one should follow the [best practices for credentials with CloudFormation](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/security-best-practices.html#creds).

An example of using a predefined AWS Secrets Manager secret for storing the sensitive information can be found below:

```ts
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { GoogleAnalytics4ConnectorProfile } from '@cdklabs/cdk-appflow';

declare const stack: Stack;

const secret = Secret.fromSecretNameV2(stack, 'GA4Secret', 'appflow/ga4');

const profile = new GoogleAnalytics4ConnectorProfile(stack, 'GA4Connector', {
  oAuth: {
    flow: {
      refreshTokenGrant: {
        refreshToken: secret.secretValueFromJson('refreshToken').toString(),
        clientId: secret.secretValueFromJson('clientId').toString(),
        clientSecret: secret.secretValueFromJson('clientSecret').toString(),
      },
    },
  },
});

```

## An approach to managing permissions

This library relies on an internal `AppFlowPermissionsManager` class to automatically infer and apply appropriate resource policy statements to the S3 Bucket, KMS Key, and Secrets Manager Secret resources. `AppFlowPermissionsManager` places the statements exactly once for the `appflow.amazonaws.com` principal no matter how many times a resource is reused in the code.

### Confused Deputy Problem

Amazon AppFlow is an account-bound and a regional service. With this it is invurlnerable to the confused deputy problem (see, e.g. [here](https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html)). However, `AppFlowPermissionsManager` still introduces the `aws:SourceAccount` condtition to the resource policies as a *best practice*.
# API Reference <a name="API Reference" id="api-reference"></a>

## Constructs <a name="Constructs" id="Constructs"></a>

### ConnectorProfileBase <a name="ConnectorProfileBase" id="@cdklabs/cdk-appflow.ConnectorProfileBase"></a>

- *Implements:* <a href="#@cdklabs/cdk-appflow.IConnectorProfile">IConnectorProfile</a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.ConnectorProfileBase.Initializer"></a>

```typescript
import { ConnectorProfileBase } from '@cdklabs/cdk-appflow'

new ConnectorProfileBase(scope: Construct, id: string, props: ConnectorProfileProps, connectorType: ConnectorType)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ConnectorProfileBase.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ConnectorProfileBase.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ConnectorProfileBase.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.ConnectorProfileProps">ConnectorProfileProps</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ConnectorProfileBase.Initializer.parameter.connectorType">connectorType</a></code> | <code><a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.ConnectorProfileBase.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.ConnectorProfileBase.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.ConnectorProfileBase.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.ConnectorProfileProps">ConnectorProfileProps</a>

---

##### `connectorType`<sup>Required</sup> <a name="connectorType" id="@cdklabs/cdk-appflow.ConnectorProfileBase.Initializer.parameter.connectorType"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ConnectorProfileBase.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@cdklabs/cdk-appflow.ConnectorProfileBase.applyRemovalPolicy">applyRemovalPolicy</a></code> | Apply the given removal policy to this resource. |

---

##### `toString` <a name="toString" id="@cdklabs/cdk-appflow.ConnectorProfileBase.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `applyRemovalPolicy` <a name="applyRemovalPolicy" id="@cdklabs/cdk-appflow.ConnectorProfileBase.applyRemovalPolicy"></a>

```typescript
public applyRemovalPolicy(policy: RemovalPolicy): void
```

Apply the given removal policy to this resource.

The Removal Policy controls what happens to this resource when it stops
being managed by CloudFormation, either because you've removed it from the
CDK application or because you've made a change that requires the resource
to be replaced.

The resource can be deleted (`RemovalPolicy.DESTROY`), or left in your AWS
account for data recovery and cleanup later (`RemovalPolicy.RETAIN`).

###### `policy`<sup>Required</sup> <a name="policy" id="@cdklabs/cdk-appflow.ConnectorProfileBase.applyRemovalPolicy.parameter.policy"></a>

- *Type:* aws-cdk-lib.RemovalPolicy

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ConnectorProfileBase.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |
| <code><a href="#@cdklabs/cdk-appflow.ConnectorProfileBase.isOwnedResource">isOwnedResource</a></code> | Returns true if the construct was created by CDK, and false otherwise. |
| <code><a href="#@cdklabs/cdk-appflow.ConnectorProfileBase.isResource">isResource</a></code> | Check whether the given construct is a Resource. |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="@cdklabs/cdk-appflow.ConnectorProfileBase.isConstruct"></a>

```typescript
import { ConnectorProfileBase } from '@cdklabs/cdk-appflow'

ConnectorProfileBase.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="@cdklabs/cdk-appflow.ConnectorProfileBase.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

##### `isOwnedResource` <a name="isOwnedResource" id="@cdklabs/cdk-appflow.ConnectorProfileBase.isOwnedResource"></a>

```typescript
import { ConnectorProfileBase } from '@cdklabs/cdk-appflow'

ConnectorProfileBase.isOwnedResource(construct: IConstruct)
```

Returns true if the construct was created by CDK, and false otherwise.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.ConnectorProfileBase.isOwnedResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `isResource` <a name="isResource" id="@cdklabs/cdk-appflow.ConnectorProfileBase.isResource"></a>

```typescript
import { ConnectorProfileBase } from '@cdklabs/cdk-appflow'

ConnectorProfileBase.isResource(construct: IConstruct)
```

Check whether the given construct is a Resource.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.ConnectorProfileBase.isResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ConnectorProfileBase.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@cdklabs/cdk-appflow.ConnectorProfileBase.property.env">env</a></code> | <code>aws-cdk-lib.ResourceEnvironment</code> | The environment this resource belongs to. |
| <code><a href="#@cdklabs/cdk-appflow.ConnectorProfileBase.property.stack">stack</a></code> | <code>aws-cdk-lib.Stack</code> | The stack in which this resource is defined. |
| <code><a href="#@cdklabs/cdk-appflow.ConnectorProfileBase.property.arn">arn</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ConnectorProfileBase.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ConnectorProfileBase.property.credentials">credentials</a></code> | <code>aws-cdk-lib.aws_secretsmanager.ISecret</code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-appflow.ConnectorProfileBase.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `env`<sup>Required</sup> <a name="env" id="@cdklabs/cdk-appflow.ConnectorProfileBase.property.env"></a>

```typescript
public readonly env: ResourceEnvironment;
```

- *Type:* aws-cdk-lib.ResourceEnvironment

The environment this resource belongs to.

For resources that are created and managed by the CDK
(generally, those created by creating new class instances like Role, Bucket, etc.),
this is always the same as the environment of the stack they belong to;
however, for imported resources
(those obtained from static methods like fromRoleArn, fromBucketName, etc.),
that might be different than the stack they were imported into.

---

##### `stack`<sup>Required</sup> <a name="stack" id="@cdklabs/cdk-appflow.ConnectorProfileBase.property.stack"></a>

```typescript
public readonly stack: Stack;
```

- *Type:* aws-cdk-lib.Stack

The stack in which this resource is defined.

---

##### `arn`<sup>Required</sup> <a name="arn" id="@cdklabs/cdk-appflow.ConnectorProfileBase.property.arn"></a>

```typescript
public readonly arn: string;
```

- *Type:* string

---

##### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.ConnectorProfileBase.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `credentials`<sup>Optional</sup> <a name="credentials" id="@cdklabs/cdk-appflow.ConnectorProfileBase.property.credentials"></a>

```typescript
public readonly credentials: ISecret;
```

- *Type:* aws-cdk-lib.aws_secretsmanager.ISecret

---


### FlowBase <a name="FlowBase" id="@cdklabs/cdk-appflow.FlowBase"></a>

- *Implements:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.FlowBase.Initializer"></a>

```typescript
import { FlowBase } from '@cdklabs/cdk-appflow'

new FlowBase(scope: Construct, id: string, props: FlowBaseProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.FlowBase.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FlowBase.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FlowBase.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.FlowBaseProps">FlowBaseProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.FlowBase.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.FlowBase.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.FlowBase.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.FlowBaseProps">FlowBaseProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.FlowBase.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@cdklabs/cdk-appflow.FlowBase.applyRemovalPolicy">applyRemovalPolicy</a></code> | Apply the given removal policy to this resource. |
| <code><a href="#@cdklabs/cdk-appflow.FlowBase.onEvent">onEvent</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FlowBase.onRunCompleted">onRunCompleted</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FlowBase.onRunStarted">onRunStarted</a></code> | *No description.* |

---

##### `toString` <a name="toString" id="@cdklabs/cdk-appflow.FlowBase.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `applyRemovalPolicy` <a name="applyRemovalPolicy" id="@cdklabs/cdk-appflow.FlowBase.applyRemovalPolicy"></a>

```typescript
public applyRemovalPolicy(policy: RemovalPolicy): void
```

Apply the given removal policy to this resource.

The Removal Policy controls what happens to this resource when it stops
being managed by CloudFormation, either because you've removed it from the
CDK application or because you've made a change that requires the resource
to be replaced.

The resource can be deleted (`RemovalPolicy.DESTROY`), or left in your AWS
account for data recovery and cleanup later (`RemovalPolicy.RETAIN`).

###### `policy`<sup>Required</sup> <a name="policy" id="@cdklabs/cdk-appflow.FlowBase.applyRemovalPolicy.parameter.policy"></a>

- *Type:* aws-cdk-lib.RemovalPolicy

---

##### `onEvent` <a name="onEvent" id="@cdklabs/cdk-appflow.FlowBase.onEvent"></a>

```typescript
public onEvent(id: string, options?: OnEventOptions): Rule
```

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.FlowBase.onEvent.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Optional</sup> <a name="options" id="@cdklabs/cdk-appflow.FlowBase.onEvent.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_events.OnEventOptions

---

##### `onRunCompleted` <a name="onRunCompleted" id="@cdklabs/cdk-appflow.FlowBase.onRunCompleted"></a>

```typescript
public onRunCompleted(id: string, options?: OnEventOptions): Rule
```

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.FlowBase.onRunCompleted.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Optional</sup> <a name="options" id="@cdklabs/cdk-appflow.FlowBase.onRunCompleted.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_events.OnEventOptions

---

##### `onRunStarted` <a name="onRunStarted" id="@cdklabs/cdk-appflow.FlowBase.onRunStarted"></a>

```typescript
public onRunStarted(id: string, options?: OnEventOptions): Rule
```

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.FlowBase.onRunStarted.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Optional</sup> <a name="options" id="@cdklabs/cdk-appflow.FlowBase.onRunStarted.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_events.OnEventOptions

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.FlowBase.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |
| <code><a href="#@cdklabs/cdk-appflow.FlowBase.isOwnedResource">isOwnedResource</a></code> | Returns true if the construct was created by CDK, and false otherwise. |
| <code><a href="#@cdklabs/cdk-appflow.FlowBase.isResource">isResource</a></code> | Check whether the given construct is a Resource. |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="@cdklabs/cdk-appflow.FlowBase.isConstruct"></a>

```typescript
import { FlowBase } from '@cdklabs/cdk-appflow'

FlowBase.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="@cdklabs/cdk-appflow.FlowBase.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

##### `isOwnedResource` <a name="isOwnedResource" id="@cdklabs/cdk-appflow.FlowBase.isOwnedResource"></a>

```typescript
import { FlowBase } from '@cdklabs/cdk-appflow'

FlowBase.isOwnedResource(construct: IConstruct)
```

Returns true if the construct was created by CDK, and false otherwise.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.FlowBase.isOwnedResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `isResource` <a name="isResource" id="@cdklabs/cdk-appflow.FlowBase.isResource"></a>

```typescript
import { FlowBase } from '@cdklabs/cdk-appflow'

FlowBase.isResource(construct: IConstruct)
```

Check whether the given construct is a Resource.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.FlowBase.isResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.FlowBase.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@cdklabs/cdk-appflow.FlowBase.property.env">env</a></code> | <code>aws-cdk-lib.ResourceEnvironment</code> | The environment this resource belongs to. |
| <code><a href="#@cdklabs/cdk-appflow.FlowBase.property.stack">stack</a></code> | <code>aws-cdk-lib.Stack</code> | The stack in which this resource is defined. |
| <code><a href="#@cdklabs/cdk-appflow.FlowBase.property.arn">arn</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FlowBase.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FlowBase.property.type">type</a></code> | <code><a href="#@cdklabs/cdk-appflow.FlowType">FlowType</a></code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-appflow.FlowBase.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `env`<sup>Required</sup> <a name="env" id="@cdklabs/cdk-appflow.FlowBase.property.env"></a>

```typescript
public readonly env: ResourceEnvironment;
```

- *Type:* aws-cdk-lib.ResourceEnvironment

The environment this resource belongs to.

For resources that are created and managed by the CDK
(generally, those created by creating new class instances like Role, Bucket, etc.),
this is always the same as the environment of the stack they belong to;
however, for imported resources
(those obtained from static methods like fromRoleArn, fromBucketName, etc.),
that might be different than the stack they were imported into.

---

##### `stack`<sup>Required</sup> <a name="stack" id="@cdklabs/cdk-appflow.FlowBase.property.stack"></a>

```typescript
public readonly stack: Stack;
```

- *Type:* aws-cdk-lib.Stack

The stack in which this resource is defined.

---

##### `arn`<sup>Required</sup> <a name="arn" id="@cdklabs/cdk-appflow.FlowBase.property.arn"></a>

```typescript
public readonly arn: string;
```

- *Type:* string

---

##### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.FlowBase.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `type`<sup>Required</sup> <a name="type" id="@cdklabs/cdk-appflow.FlowBase.property.type"></a>

```typescript
public readonly type: FlowType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.FlowType">FlowType</a>

---


### GoogleAnalytics4ConnectorProfile <a name="GoogleAnalytics4ConnectorProfile" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile"></a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.Initializer"></a>

```typescript
import { GoogleAnalytics4ConnectorProfile } from '@cdklabs/cdk-appflow'

new GoogleAnalytics4ConnectorProfile(scope: Construct, id: string, props: GoogleAnalytics4ConnectorProfileProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfileProps">GoogleAnalytics4ConnectorProfileProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfileProps">GoogleAnalytics4ConnectorProfileProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.applyRemovalPolicy">applyRemovalPolicy</a></code> | Apply the given removal policy to this resource. |

---

##### `toString` <a name="toString" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `applyRemovalPolicy` <a name="applyRemovalPolicy" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.applyRemovalPolicy"></a>

```typescript
public applyRemovalPolicy(policy: RemovalPolicy): void
```

Apply the given removal policy to this resource.

The Removal Policy controls what happens to this resource when it stops
being managed by CloudFormation, either because you've removed it from the
CDK application or because you've made a change that requires the resource
to be replaced.

The resource can be deleted (`RemovalPolicy.DESTROY`), or left in your AWS
account for data recovery and cleanup later (`RemovalPolicy.RETAIN`).

###### `policy`<sup>Required</sup> <a name="policy" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.applyRemovalPolicy.parameter.policy"></a>

- *Type:* aws-cdk-lib.RemovalPolicy

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.isOwnedResource">isOwnedResource</a></code> | Returns true if the construct was created by CDK, and false otherwise. |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.isResource">isResource</a></code> | Check whether the given construct is a Resource. |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.fromConnectionProfileArn">fromConnectionProfileArn</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.fromConnectionProfileName">fromConnectionProfileName</a></code> | *No description.* |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.isConstruct"></a>

```typescript
import { GoogleAnalytics4ConnectorProfile } from '@cdklabs/cdk-appflow'

GoogleAnalytics4ConnectorProfile.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

##### `isOwnedResource` <a name="isOwnedResource" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.isOwnedResource"></a>

```typescript
import { GoogleAnalytics4ConnectorProfile } from '@cdklabs/cdk-appflow'

GoogleAnalytics4ConnectorProfile.isOwnedResource(construct: IConstruct)
```

Returns true if the construct was created by CDK, and false otherwise.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.isOwnedResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `isResource` <a name="isResource" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.isResource"></a>

```typescript
import { GoogleAnalytics4ConnectorProfile } from '@cdklabs/cdk-appflow'

GoogleAnalytics4ConnectorProfile.isResource(construct: IConstruct)
```

Check whether the given construct is a Resource.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.isResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `fromConnectionProfileArn` <a name="fromConnectionProfileArn" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.fromConnectionProfileArn"></a>

```typescript
import { GoogleAnalytics4ConnectorProfile } from '@cdklabs/cdk-appflow'

GoogleAnalytics4ConnectorProfile.fromConnectionProfileArn(scope: Construct, id: string, arn: string)
```

###### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.fromConnectionProfileArn.parameter.scope"></a>

- *Type:* constructs.Construct

---

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.fromConnectionProfileArn.parameter.id"></a>

- *Type:* string

---

###### `arn`<sup>Required</sup> <a name="arn" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.fromConnectionProfileArn.parameter.arn"></a>

- *Type:* string

---

##### `fromConnectionProfileName` <a name="fromConnectionProfileName" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.fromConnectionProfileName"></a>

```typescript
import { GoogleAnalytics4ConnectorProfile } from '@cdklabs/cdk-appflow'

GoogleAnalytics4ConnectorProfile.fromConnectionProfileName(scope: Construct, id: string, name: string)
```

###### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.fromConnectionProfileName.parameter.scope"></a>

- *Type:* constructs.Construct

---

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.fromConnectionProfileName.parameter.id"></a>

- *Type:* string

---

###### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.fromConnectionProfileName.parameter.name"></a>

- *Type:* string

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.property.env">env</a></code> | <code>aws-cdk-lib.ResourceEnvironment</code> | The environment this resource belongs to. |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.property.stack">stack</a></code> | <code>aws-cdk-lib.Stack</code> | The stack in which this resource is defined. |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.property.arn">arn</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.property.credentials">credentials</a></code> | <code>aws-cdk-lib.aws_secretsmanager.ISecret</code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `env`<sup>Required</sup> <a name="env" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.property.env"></a>

```typescript
public readonly env: ResourceEnvironment;
```

- *Type:* aws-cdk-lib.ResourceEnvironment

The environment this resource belongs to.

For resources that are created and managed by the CDK
(generally, those created by creating new class instances like Role, Bucket, etc.),
this is always the same as the environment of the stack they belong to;
however, for imported resources
(those obtained from static methods like fromRoleArn, fromBucketName, etc.),
that might be different than the stack they were imported into.

---

##### `stack`<sup>Required</sup> <a name="stack" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.property.stack"></a>

```typescript
public readonly stack: Stack;
```

- *Type:* aws-cdk-lib.Stack

The stack in which this resource is defined.

---

##### `arn`<sup>Required</sup> <a name="arn" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.property.arn"></a>

```typescript
public readonly arn: string;
```

- *Type:* string

---

##### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `credentials`<sup>Optional</sup> <a name="credentials" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile.property.credentials"></a>

```typescript
public readonly credentials: ISecret;
```

- *Type:* aws-cdk-lib.aws_secretsmanager.ISecret

---


### MarketoConnectorProfile <a name="MarketoConnectorProfile" id="@cdklabs/cdk-appflow.MarketoConnectorProfile"></a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.MarketoConnectorProfile.Initializer"></a>

```typescript
import { MarketoConnectorProfile } from '@cdklabs/cdk-appflow'

new MarketoConnectorProfile(scope: Construct, id: string, props: MarketoConnectorProfileProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MarketoConnectorProfile.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.MarketoConnectorProfile.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.MarketoConnectorProfile.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.MarketoConnectorProfileProps">MarketoConnectorProfileProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.MarketoConnectorProfile.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.MarketoConnectorProfile.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.MarketoConnectorProfile.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.MarketoConnectorProfileProps">MarketoConnectorProfileProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MarketoConnectorProfile.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@cdklabs/cdk-appflow.MarketoConnectorProfile.applyRemovalPolicy">applyRemovalPolicy</a></code> | Apply the given removal policy to this resource. |

---

##### `toString` <a name="toString" id="@cdklabs/cdk-appflow.MarketoConnectorProfile.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `applyRemovalPolicy` <a name="applyRemovalPolicy" id="@cdklabs/cdk-appflow.MarketoConnectorProfile.applyRemovalPolicy"></a>

```typescript
public applyRemovalPolicy(policy: RemovalPolicy): void
```

Apply the given removal policy to this resource.

The Removal Policy controls what happens to this resource when it stops
being managed by CloudFormation, either because you've removed it from the
CDK application or because you've made a change that requires the resource
to be replaced.

The resource can be deleted (`RemovalPolicy.DESTROY`), or left in your AWS
account for data recovery and cleanup later (`RemovalPolicy.RETAIN`).

###### `policy`<sup>Required</sup> <a name="policy" id="@cdklabs/cdk-appflow.MarketoConnectorProfile.applyRemovalPolicy.parameter.policy"></a>

- *Type:* aws-cdk-lib.RemovalPolicy

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MarketoConnectorProfile.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |
| <code><a href="#@cdklabs/cdk-appflow.MarketoConnectorProfile.isOwnedResource">isOwnedResource</a></code> | Returns true if the construct was created by CDK, and false otherwise. |
| <code><a href="#@cdklabs/cdk-appflow.MarketoConnectorProfile.isResource">isResource</a></code> | Check whether the given construct is a Resource. |
| <code><a href="#@cdklabs/cdk-appflow.MarketoConnectorProfile.fromConnectionProfileArn">fromConnectionProfileArn</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.MarketoConnectorProfile.fromConnectionProfileName">fromConnectionProfileName</a></code> | *No description.* |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="@cdklabs/cdk-appflow.MarketoConnectorProfile.isConstruct"></a>

```typescript
import { MarketoConnectorProfile } from '@cdklabs/cdk-appflow'

MarketoConnectorProfile.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="@cdklabs/cdk-appflow.MarketoConnectorProfile.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

##### `isOwnedResource` <a name="isOwnedResource" id="@cdklabs/cdk-appflow.MarketoConnectorProfile.isOwnedResource"></a>

```typescript
import { MarketoConnectorProfile } from '@cdklabs/cdk-appflow'

MarketoConnectorProfile.isOwnedResource(construct: IConstruct)
```

Returns true if the construct was created by CDK, and false otherwise.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.MarketoConnectorProfile.isOwnedResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `isResource` <a name="isResource" id="@cdklabs/cdk-appflow.MarketoConnectorProfile.isResource"></a>

```typescript
import { MarketoConnectorProfile } from '@cdklabs/cdk-appflow'

MarketoConnectorProfile.isResource(construct: IConstruct)
```

Check whether the given construct is a Resource.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.MarketoConnectorProfile.isResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `fromConnectionProfileArn` <a name="fromConnectionProfileArn" id="@cdklabs/cdk-appflow.MarketoConnectorProfile.fromConnectionProfileArn"></a>

```typescript
import { MarketoConnectorProfile } from '@cdklabs/cdk-appflow'

MarketoConnectorProfile.fromConnectionProfileArn(scope: Construct, id: string, arn: string)
```

###### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.MarketoConnectorProfile.fromConnectionProfileArn.parameter.scope"></a>

- *Type:* constructs.Construct

---

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.MarketoConnectorProfile.fromConnectionProfileArn.parameter.id"></a>

- *Type:* string

---

###### `arn`<sup>Required</sup> <a name="arn" id="@cdklabs/cdk-appflow.MarketoConnectorProfile.fromConnectionProfileArn.parameter.arn"></a>

- *Type:* string

---

##### `fromConnectionProfileName` <a name="fromConnectionProfileName" id="@cdklabs/cdk-appflow.MarketoConnectorProfile.fromConnectionProfileName"></a>

```typescript
import { MarketoConnectorProfile } from '@cdklabs/cdk-appflow'

MarketoConnectorProfile.fromConnectionProfileName(scope: Construct, id: string, name: string)
```

###### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.MarketoConnectorProfile.fromConnectionProfileName.parameter.scope"></a>

- *Type:* constructs.Construct

---

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.MarketoConnectorProfile.fromConnectionProfileName.parameter.id"></a>

- *Type:* string

---

###### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.MarketoConnectorProfile.fromConnectionProfileName.parameter.name"></a>

- *Type:* string

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MarketoConnectorProfile.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@cdklabs/cdk-appflow.MarketoConnectorProfile.property.env">env</a></code> | <code>aws-cdk-lib.ResourceEnvironment</code> | The environment this resource belongs to. |
| <code><a href="#@cdklabs/cdk-appflow.MarketoConnectorProfile.property.stack">stack</a></code> | <code>aws-cdk-lib.Stack</code> | The stack in which this resource is defined. |
| <code><a href="#@cdklabs/cdk-appflow.MarketoConnectorProfile.property.arn">arn</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.MarketoConnectorProfile.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.MarketoConnectorProfile.property.credentials">credentials</a></code> | <code>aws-cdk-lib.aws_secretsmanager.ISecret</code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-appflow.MarketoConnectorProfile.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `env`<sup>Required</sup> <a name="env" id="@cdklabs/cdk-appflow.MarketoConnectorProfile.property.env"></a>

```typescript
public readonly env: ResourceEnvironment;
```

- *Type:* aws-cdk-lib.ResourceEnvironment

The environment this resource belongs to.

For resources that are created and managed by the CDK
(generally, those created by creating new class instances like Role, Bucket, etc.),
this is always the same as the environment of the stack they belong to;
however, for imported resources
(those obtained from static methods like fromRoleArn, fromBucketName, etc.),
that might be different than the stack they were imported into.

---

##### `stack`<sup>Required</sup> <a name="stack" id="@cdklabs/cdk-appflow.MarketoConnectorProfile.property.stack"></a>

```typescript
public readonly stack: Stack;
```

- *Type:* aws-cdk-lib.Stack

The stack in which this resource is defined.

---

##### `arn`<sup>Required</sup> <a name="arn" id="@cdklabs/cdk-appflow.MarketoConnectorProfile.property.arn"></a>

```typescript
public readonly arn: string;
```

- *Type:* string

---

##### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.MarketoConnectorProfile.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `credentials`<sup>Optional</sup> <a name="credentials" id="@cdklabs/cdk-appflow.MarketoConnectorProfile.property.credentials"></a>

```typescript
public readonly credentials: ISecret;
```

- *Type:* aws-cdk-lib.aws_secretsmanager.ISecret

---


### MicrosoftSharepointOnlineConnectorProfile <a name="MicrosoftSharepointOnlineConnectorProfile" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile"></a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.Initializer"></a>

```typescript
import { MicrosoftSharepointOnlineConnectorProfile } from '@cdklabs/cdk-appflow'

new MicrosoftSharepointOnlineConnectorProfile(scope: Construct, id: string, props: MicrosoftSharepointOnlineConnectorProfileProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfileProps">MicrosoftSharepointOnlineConnectorProfileProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfileProps">MicrosoftSharepointOnlineConnectorProfileProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.applyRemovalPolicy">applyRemovalPolicy</a></code> | Apply the given removal policy to this resource. |

---

##### `toString` <a name="toString" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `applyRemovalPolicy` <a name="applyRemovalPolicy" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.applyRemovalPolicy"></a>

```typescript
public applyRemovalPolicy(policy: RemovalPolicy): void
```

Apply the given removal policy to this resource.

The Removal Policy controls what happens to this resource when it stops
being managed by CloudFormation, either because you've removed it from the
CDK application or because you've made a change that requires the resource
to be replaced.

The resource can be deleted (`RemovalPolicy.DESTROY`), or left in your AWS
account for data recovery and cleanup later (`RemovalPolicy.RETAIN`).

###### `policy`<sup>Required</sup> <a name="policy" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.applyRemovalPolicy.parameter.policy"></a>

- *Type:* aws-cdk-lib.RemovalPolicy

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.isOwnedResource">isOwnedResource</a></code> | Returns true if the construct was created by CDK, and false otherwise. |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.isResource">isResource</a></code> | Check whether the given construct is a Resource. |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.fromConnectionProfileArn">fromConnectionProfileArn</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.fromConnectionProfileName">fromConnectionProfileName</a></code> | *No description.* |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.isConstruct"></a>

```typescript
import { MicrosoftSharepointOnlineConnectorProfile } from '@cdklabs/cdk-appflow'

MicrosoftSharepointOnlineConnectorProfile.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

##### `isOwnedResource` <a name="isOwnedResource" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.isOwnedResource"></a>

```typescript
import { MicrosoftSharepointOnlineConnectorProfile } from '@cdklabs/cdk-appflow'

MicrosoftSharepointOnlineConnectorProfile.isOwnedResource(construct: IConstruct)
```

Returns true if the construct was created by CDK, and false otherwise.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.isOwnedResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `isResource` <a name="isResource" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.isResource"></a>

```typescript
import { MicrosoftSharepointOnlineConnectorProfile } from '@cdklabs/cdk-appflow'

MicrosoftSharepointOnlineConnectorProfile.isResource(construct: IConstruct)
```

Check whether the given construct is a Resource.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.isResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `fromConnectionProfileArn` <a name="fromConnectionProfileArn" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.fromConnectionProfileArn"></a>

```typescript
import { MicrosoftSharepointOnlineConnectorProfile } from '@cdklabs/cdk-appflow'

MicrosoftSharepointOnlineConnectorProfile.fromConnectionProfileArn(scope: Construct, id: string, arn: string)
```

###### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.fromConnectionProfileArn.parameter.scope"></a>

- *Type:* constructs.Construct

---

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.fromConnectionProfileArn.parameter.id"></a>

- *Type:* string

---

###### `arn`<sup>Required</sup> <a name="arn" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.fromConnectionProfileArn.parameter.arn"></a>

- *Type:* string

---

##### `fromConnectionProfileName` <a name="fromConnectionProfileName" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.fromConnectionProfileName"></a>

```typescript
import { MicrosoftSharepointOnlineConnectorProfile } from '@cdklabs/cdk-appflow'

MicrosoftSharepointOnlineConnectorProfile.fromConnectionProfileName(scope: Construct, id: string, name: string)
```

###### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.fromConnectionProfileName.parameter.scope"></a>

- *Type:* constructs.Construct

---

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.fromConnectionProfileName.parameter.id"></a>

- *Type:* string

---

###### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.fromConnectionProfileName.parameter.name"></a>

- *Type:* string

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.property.env">env</a></code> | <code>aws-cdk-lib.ResourceEnvironment</code> | The environment this resource belongs to. |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.property.stack">stack</a></code> | <code>aws-cdk-lib.Stack</code> | The stack in which this resource is defined. |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.property.arn">arn</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.property.credentials">credentials</a></code> | <code>aws-cdk-lib.aws_secretsmanager.ISecret</code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `env`<sup>Required</sup> <a name="env" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.property.env"></a>

```typescript
public readonly env: ResourceEnvironment;
```

- *Type:* aws-cdk-lib.ResourceEnvironment

The environment this resource belongs to.

For resources that are created and managed by the CDK
(generally, those created by creating new class instances like Role, Bucket, etc.),
this is always the same as the environment of the stack they belong to;
however, for imported resources
(those obtained from static methods like fromRoleArn, fromBucketName, etc.),
that might be different than the stack they were imported into.

---

##### `stack`<sup>Required</sup> <a name="stack" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.property.stack"></a>

```typescript
public readonly stack: Stack;
```

- *Type:* aws-cdk-lib.Stack

The stack in which this resource is defined.

---

##### `arn`<sup>Required</sup> <a name="arn" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.property.arn"></a>

```typescript
public readonly arn: string;
```

- *Type:* string

---

##### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `credentials`<sup>Optional</sup> <a name="credentials" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile.property.credentials"></a>

```typescript
public readonly credentials: ISecret;
```

- *Type:* aws-cdk-lib.aws_secretsmanager.ISecret

---


### OnDemandFlow <a name="OnDemandFlow" id="@cdklabs/cdk-appflow.OnDemandFlow"></a>

- *Implements:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.OnDemandFlow.Initializer"></a>

```typescript
import { OnDemandFlow } from '@cdklabs/cdk-appflow'

new OnDemandFlow(scope: Construct, id: string, props: OnDemandFlowProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.OnDemandFlow.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnDemandFlow.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnDemandFlow.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.OnDemandFlowProps">OnDemandFlowProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.OnDemandFlow.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.OnDemandFlow.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.OnDemandFlow.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.OnDemandFlowProps">OnDemandFlowProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.OnDemandFlow.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@cdklabs/cdk-appflow.OnDemandFlow.applyRemovalPolicy">applyRemovalPolicy</a></code> | Apply the given removal policy to this resource. |
| <code><a href="#@cdklabs/cdk-appflow.OnDemandFlow.onEvent">onEvent</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnDemandFlow.onRunCompleted">onRunCompleted</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnDemandFlow.onRunStarted">onRunStarted</a></code> | *No description.* |

---

##### `toString` <a name="toString" id="@cdklabs/cdk-appflow.OnDemandFlow.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `applyRemovalPolicy` <a name="applyRemovalPolicy" id="@cdklabs/cdk-appflow.OnDemandFlow.applyRemovalPolicy"></a>

```typescript
public applyRemovalPolicy(policy: RemovalPolicy): void
```

Apply the given removal policy to this resource.

The Removal Policy controls what happens to this resource when it stops
being managed by CloudFormation, either because you've removed it from the
CDK application or because you've made a change that requires the resource
to be replaced.

The resource can be deleted (`RemovalPolicy.DESTROY`), or left in your AWS
account for data recovery and cleanup later (`RemovalPolicy.RETAIN`).

###### `policy`<sup>Required</sup> <a name="policy" id="@cdklabs/cdk-appflow.OnDemandFlow.applyRemovalPolicy.parameter.policy"></a>

- *Type:* aws-cdk-lib.RemovalPolicy

---

##### `onEvent` <a name="onEvent" id="@cdklabs/cdk-appflow.OnDemandFlow.onEvent"></a>

```typescript
public onEvent(id: string, options?: OnEventOptions): Rule
```

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.OnDemandFlow.onEvent.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Optional</sup> <a name="options" id="@cdklabs/cdk-appflow.OnDemandFlow.onEvent.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_events.OnEventOptions

---

##### `onRunCompleted` <a name="onRunCompleted" id="@cdklabs/cdk-appflow.OnDemandFlow.onRunCompleted"></a>

```typescript
public onRunCompleted(id: string, options?: OnEventOptions): Rule
```

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.OnDemandFlow.onRunCompleted.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Optional</sup> <a name="options" id="@cdklabs/cdk-appflow.OnDemandFlow.onRunCompleted.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_events.OnEventOptions

---

##### `onRunStarted` <a name="onRunStarted" id="@cdklabs/cdk-appflow.OnDemandFlow.onRunStarted"></a>

```typescript
public onRunStarted(id: string, options?: OnEventOptions): Rule
```

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.OnDemandFlow.onRunStarted.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Optional</sup> <a name="options" id="@cdklabs/cdk-appflow.OnDemandFlow.onRunStarted.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_events.OnEventOptions

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.OnDemandFlow.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |
| <code><a href="#@cdklabs/cdk-appflow.OnDemandFlow.isOwnedResource">isOwnedResource</a></code> | Returns true if the construct was created by CDK, and false otherwise. |
| <code><a href="#@cdklabs/cdk-appflow.OnDemandFlow.isResource">isResource</a></code> | Check whether the given construct is a Resource. |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="@cdklabs/cdk-appflow.OnDemandFlow.isConstruct"></a>

```typescript
import { OnDemandFlow } from '@cdklabs/cdk-appflow'

OnDemandFlow.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="@cdklabs/cdk-appflow.OnDemandFlow.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

##### `isOwnedResource` <a name="isOwnedResource" id="@cdklabs/cdk-appflow.OnDemandFlow.isOwnedResource"></a>

```typescript
import { OnDemandFlow } from '@cdklabs/cdk-appflow'

OnDemandFlow.isOwnedResource(construct: IConstruct)
```

Returns true if the construct was created by CDK, and false otherwise.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.OnDemandFlow.isOwnedResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `isResource` <a name="isResource" id="@cdklabs/cdk-appflow.OnDemandFlow.isResource"></a>

```typescript
import { OnDemandFlow } from '@cdklabs/cdk-appflow'

OnDemandFlow.isResource(construct: IConstruct)
```

Check whether the given construct is a Resource.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.OnDemandFlow.isResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.OnDemandFlow.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@cdklabs/cdk-appflow.OnDemandFlow.property.env">env</a></code> | <code>aws-cdk-lib.ResourceEnvironment</code> | The environment this resource belongs to. |
| <code><a href="#@cdklabs/cdk-appflow.OnDemandFlow.property.stack">stack</a></code> | <code>aws-cdk-lib.Stack</code> | The stack in which this resource is defined. |
| <code><a href="#@cdklabs/cdk-appflow.OnDemandFlow.property.arn">arn</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnDemandFlow.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnDemandFlow.property.type">type</a></code> | <code><a href="#@cdklabs/cdk-appflow.FlowType">FlowType</a></code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-appflow.OnDemandFlow.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `env`<sup>Required</sup> <a name="env" id="@cdklabs/cdk-appflow.OnDemandFlow.property.env"></a>

```typescript
public readonly env: ResourceEnvironment;
```

- *Type:* aws-cdk-lib.ResourceEnvironment

The environment this resource belongs to.

For resources that are created and managed by the CDK
(generally, those created by creating new class instances like Role, Bucket, etc.),
this is always the same as the environment of the stack they belong to;
however, for imported resources
(those obtained from static methods like fromRoleArn, fromBucketName, etc.),
that might be different than the stack they were imported into.

---

##### `stack`<sup>Required</sup> <a name="stack" id="@cdklabs/cdk-appflow.OnDemandFlow.property.stack"></a>

```typescript
public readonly stack: Stack;
```

- *Type:* aws-cdk-lib.Stack

The stack in which this resource is defined.

---

##### `arn`<sup>Required</sup> <a name="arn" id="@cdklabs/cdk-appflow.OnDemandFlow.property.arn"></a>

```typescript
public readonly arn: string;
```

- *Type:* string

---

##### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.OnDemandFlow.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `type`<sup>Required</sup> <a name="type" id="@cdklabs/cdk-appflow.OnDemandFlow.property.type"></a>

```typescript
public readonly type: FlowType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.FlowType">FlowType</a>

---


### OnEventFlow <a name="OnEventFlow" id="@cdklabs/cdk-appflow.OnEventFlow"></a>

- *Implements:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.OnEventFlow.Initializer"></a>

```typescript
import { OnEventFlow } from '@cdklabs/cdk-appflow'

new OnEventFlow(scope: Construct, id: string, props: OnEventFlowProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlow.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlow.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlow.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.OnEventFlowProps">OnEventFlowProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.OnEventFlow.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.OnEventFlow.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.OnEventFlow.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.OnEventFlowProps">OnEventFlowProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlow.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlow.applyRemovalPolicy">applyRemovalPolicy</a></code> | Apply the given removal policy to this resource. |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlow.onEvent">onEvent</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlow.onRunCompleted">onRunCompleted</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlow.onRunStarted">onRunStarted</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlow.onDeactivated">onDeactivated</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlow.onStatus">onStatus</a></code> | *No description.* |

---

##### `toString` <a name="toString" id="@cdklabs/cdk-appflow.OnEventFlow.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `applyRemovalPolicy` <a name="applyRemovalPolicy" id="@cdklabs/cdk-appflow.OnEventFlow.applyRemovalPolicy"></a>

```typescript
public applyRemovalPolicy(policy: RemovalPolicy): void
```

Apply the given removal policy to this resource.

The Removal Policy controls what happens to this resource when it stops
being managed by CloudFormation, either because you've removed it from the
CDK application or because you've made a change that requires the resource
to be replaced.

The resource can be deleted (`RemovalPolicy.DESTROY`), or left in your AWS
account for data recovery and cleanup later (`RemovalPolicy.RETAIN`).

###### `policy`<sup>Required</sup> <a name="policy" id="@cdklabs/cdk-appflow.OnEventFlow.applyRemovalPolicy.parameter.policy"></a>

- *Type:* aws-cdk-lib.RemovalPolicy

---

##### `onEvent` <a name="onEvent" id="@cdklabs/cdk-appflow.OnEventFlow.onEvent"></a>

```typescript
public onEvent(id: string, options?: OnEventOptions): Rule
```

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.OnEventFlow.onEvent.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Optional</sup> <a name="options" id="@cdklabs/cdk-appflow.OnEventFlow.onEvent.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_events.OnEventOptions

---

##### `onRunCompleted` <a name="onRunCompleted" id="@cdklabs/cdk-appflow.OnEventFlow.onRunCompleted"></a>

```typescript
public onRunCompleted(id: string, options?: OnEventOptions): Rule
```

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.OnEventFlow.onRunCompleted.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Optional</sup> <a name="options" id="@cdklabs/cdk-appflow.OnEventFlow.onRunCompleted.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_events.OnEventOptions

---

##### `onRunStarted` <a name="onRunStarted" id="@cdklabs/cdk-appflow.OnEventFlow.onRunStarted"></a>

```typescript
public onRunStarted(id: string, options?: OnEventOptions): Rule
```

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.OnEventFlow.onRunStarted.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Optional</sup> <a name="options" id="@cdklabs/cdk-appflow.OnEventFlow.onRunStarted.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_events.OnEventOptions

---

##### `onDeactivated` <a name="onDeactivated" id="@cdklabs/cdk-appflow.OnEventFlow.onDeactivated"></a>

```typescript
public onDeactivated(id: string, options?: OnEventOptions): Rule
```

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.OnEventFlow.onDeactivated.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Optional</sup> <a name="options" id="@cdklabs/cdk-appflow.OnEventFlow.onDeactivated.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_events.OnEventOptions

---

##### `onStatus` <a name="onStatus" id="@cdklabs/cdk-appflow.OnEventFlow.onStatus"></a>

```typescript
public onStatus(id: string, options?: OnEventOptions): Rule
```

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.OnEventFlow.onStatus.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Optional</sup> <a name="options" id="@cdklabs/cdk-appflow.OnEventFlow.onStatus.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_events.OnEventOptions

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlow.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlow.isOwnedResource">isOwnedResource</a></code> | Returns true if the construct was created by CDK, and false otherwise. |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlow.isResource">isResource</a></code> | Check whether the given construct is a Resource. |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="@cdklabs/cdk-appflow.OnEventFlow.isConstruct"></a>

```typescript
import { OnEventFlow } from '@cdklabs/cdk-appflow'

OnEventFlow.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="@cdklabs/cdk-appflow.OnEventFlow.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

##### `isOwnedResource` <a name="isOwnedResource" id="@cdklabs/cdk-appflow.OnEventFlow.isOwnedResource"></a>

```typescript
import { OnEventFlow } from '@cdklabs/cdk-appflow'

OnEventFlow.isOwnedResource(construct: IConstruct)
```

Returns true if the construct was created by CDK, and false otherwise.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.OnEventFlow.isOwnedResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `isResource` <a name="isResource" id="@cdklabs/cdk-appflow.OnEventFlow.isResource"></a>

```typescript
import { OnEventFlow } from '@cdklabs/cdk-appflow'

OnEventFlow.isResource(construct: IConstruct)
```

Check whether the given construct is a Resource.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.OnEventFlow.isResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlow.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlow.property.env">env</a></code> | <code>aws-cdk-lib.ResourceEnvironment</code> | The environment this resource belongs to. |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlow.property.stack">stack</a></code> | <code>aws-cdk-lib.Stack</code> | The stack in which this resource is defined. |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlow.property.arn">arn</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlow.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlow.property.type">type</a></code> | <code><a href="#@cdklabs/cdk-appflow.FlowType">FlowType</a></code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-appflow.OnEventFlow.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `env`<sup>Required</sup> <a name="env" id="@cdklabs/cdk-appflow.OnEventFlow.property.env"></a>

```typescript
public readonly env: ResourceEnvironment;
```

- *Type:* aws-cdk-lib.ResourceEnvironment

The environment this resource belongs to.

For resources that are created and managed by the CDK
(generally, those created by creating new class instances like Role, Bucket, etc.),
this is always the same as the environment of the stack they belong to;
however, for imported resources
(those obtained from static methods like fromRoleArn, fromBucketName, etc.),
that might be different than the stack they were imported into.

---

##### `stack`<sup>Required</sup> <a name="stack" id="@cdklabs/cdk-appflow.OnEventFlow.property.stack"></a>

```typescript
public readonly stack: Stack;
```

- *Type:* aws-cdk-lib.Stack

The stack in which this resource is defined.

---

##### `arn`<sup>Required</sup> <a name="arn" id="@cdklabs/cdk-appflow.OnEventFlow.property.arn"></a>

```typescript
public readonly arn: string;
```

- *Type:* string

---

##### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.OnEventFlow.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `type`<sup>Required</sup> <a name="type" id="@cdklabs/cdk-appflow.OnEventFlow.property.type"></a>

```typescript
public readonly type: FlowType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.FlowType">FlowType</a>

---


### OnScheduleFlow <a name="OnScheduleFlow" id="@cdklabs/cdk-appflow.OnScheduleFlow"></a>

- *Implements:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.OnScheduleFlow.Initializer"></a>

```typescript
import { OnScheduleFlow } from '@cdklabs/cdk-appflow'

new OnScheduleFlow(scope: Construct, id: string, props: OnScheduleFlowProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlow.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlow.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlow.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlowProps">OnScheduleFlowProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.OnScheduleFlow.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.OnScheduleFlow.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.OnScheduleFlow.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.OnScheduleFlowProps">OnScheduleFlowProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlow.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlow.applyRemovalPolicy">applyRemovalPolicy</a></code> | Apply the given removal policy to this resource. |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlow.onEvent">onEvent</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlow.onRunCompleted">onRunCompleted</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlow.onRunStarted">onRunStarted</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlow.onDeactivated">onDeactivated</a></code> | *No description.* |

---

##### `toString` <a name="toString" id="@cdklabs/cdk-appflow.OnScheduleFlow.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `applyRemovalPolicy` <a name="applyRemovalPolicy" id="@cdklabs/cdk-appflow.OnScheduleFlow.applyRemovalPolicy"></a>

```typescript
public applyRemovalPolicy(policy: RemovalPolicy): void
```

Apply the given removal policy to this resource.

The Removal Policy controls what happens to this resource when it stops
being managed by CloudFormation, either because you've removed it from the
CDK application or because you've made a change that requires the resource
to be replaced.

The resource can be deleted (`RemovalPolicy.DESTROY`), or left in your AWS
account for data recovery and cleanup later (`RemovalPolicy.RETAIN`).

###### `policy`<sup>Required</sup> <a name="policy" id="@cdklabs/cdk-appflow.OnScheduleFlow.applyRemovalPolicy.parameter.policy"></a>

- *Type:* aws-cdk-lib.RemovalPolicy

---

##### `onEvent` <a name="onEvent" id="@cdklabs/cdk-appflow.OnScheduleFlow.onEvent"></a>

```typescript
public onEvent(id: string, options?: OnEventOptions): Rule
```

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.OnScheduleFlow.onEvent.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Optional</sup> <a name="options" id="@cdklabs/cdk-appflow.OnScheduleFlow.onEvent.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_events.OnEventOptions

---

##### `onRunCompleted` <a name="onRunCompleted" id="@cdklabs/cdk-appflow.OnScheduleFlow.onRunCompleted"></a>

```typescript
public onRunCompleted(id: string, options?: OnEventOptions): Rule
```

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.OnScheduleFlow.onRunCompleted.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Optional</sup> <a name="options" id="@cdklabs/cdk-appflow.OnScheduleFlow.onRunCompleted.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_events.OnEventOptions

---

##### `onRunStarted` <a name="onRunStarted" id="@cdklabs/cdk-appflow.OnScheduleFlow.onRunStarted"></a>

```typescript
public onRunStarted(id: string, options?: OnEventOptions): Rule
```

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.OnScheduleFlow.onRunStarted.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Optional</sup> <a name="options" id="@cdklabs/cdk-appflow.OnScheduleFlow.onRunStarted.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_events.OnEventOptions

---

##### `onDeactivated` <a name="onDeactivated" id="@cdklabs/cdk-appflow.OnScheduleFlow.onDeactivated"></a>

```typescript
public onDeactivated(id: string, options?: OnEventOptions): Rule
```

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.OnScheduleFlow.onDeactivated.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Optional</sup> <a name="options" id="@cdklabs/cdk-appflow.OnScheduleFlow.onDeactivated.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_events.OnEventOptions

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlow.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlow.isOwnedResource">isOwnedResource</a></code> | Returns true if the construct was created by CDK, and false otherwise. |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlow.isResource">isResource</a></code> | Check whether the given construct is a Resource. |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="@cdklabs/cdk-appflow.OnScheduleFlow.isConstruct"></a>

```typescript
import { OnScheduleFlow } from '@cdklabs/cdk-appflow'

OnScheduleFlow.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="@cdklabs/cdk-appflow.OnScheduleFlow.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

##### `isOwnedResource` <a name="isOwnedResource" id="@cdklabs/cdk-appflow.OnScheduleFlow.isOwnedResource"></a>

```typescript
import { OnScheduleFlow } from '@cdklabs/cdk-appflow'

OnScheduleFlow.isOwnedResource(construct: IConstruct)
```

Returns true if the construct was created by CDK, and false otherwise.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.OnScheduleFlow.isOwnedResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `isResource` <a name="isResource" id="@cdklabs/cdk-appflow.OnScheduleFlow.isResource"></a>

```typescript
import { OnScheduleFlow } from '@cdklabs/cdk-appflow'

OnScheduleFlow.isResource(construct: IConstruct)
```

Check whether the given construct is a Resource.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.OnScheduleFlow.isResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlow.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlow.property.env">env</a></code> | <code>aws-cdk-lib.ResourceEnvironment</code> | The environment this resource belongs to. |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlow.property.stack">stack</a></code> | <code>aws-cdk-lib.Stack</code> | The stack in which this resource is defined. |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlow.property.arn">arn</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlow.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlow.property.type">type</a></code> | <code><a href="#@cdklabs/cdk-appflow.FlowType">FlowType</a></code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-appflow.OnScheduleFlow.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `env`<sup>Required</sup> <a name="env" id="@cdklabs/cdk-appflow.OnScheduleFlow.property.env"></a>

```typescript
public readonly env: ResourceEnvironment;
```

- *Type:* aws-cdk-lib.ResourceEnvironment

The environment this resource belongs to.

For resources that are created and managed by the CDK
(generally, those created by creating new class instances like Role, Bucket, etc.),
this is always the same as the environment of the stack they belong to;
however, for imported resources
(those obtained from static methods like fromRoleArn, fromBucketName, etc.),
that might be different than the stack they were imported into.

---

##### `stack`<sup>Required</sup> <a name="stack" id="@cdklabs/cdk-appflow.OnScheduleFlow.property.stack"></a>

```typescript
public readonly stack: Stack;
```

- *Type:* aws-cdk-lib.Stack

The stack in which this resource is defined.

---

##### `arn`<sup>Required</sup> <a name="arn" id="@cdklabs/cdk-appflow.OnScheduleFlow.property.arn"></a>

```typescript
public readonly arn: string;
```

- *Type:* string

---

##### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.OnScheduleFlow.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `type`<sup>Required</sup> <a name="type" id="@cdklabs/cdk-appflow.OnScheduleFlow.property.type"></a>

```typescript
public readonly type: FlowType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.FlowType">FlowType</a>

---


### RedshiftConnectorProfile <a name="RedshiftConnectorProfile" id="@cdklabs/cdk-appflow.RedshiftConnectorProfile"></a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.RedshiftConnectorProfile.Initializer"></a>

```typescript
import { RedshiftConnectorProfile } from '@cdklabs/cdk-appflow'

new RedshiftConnectorProfile(scope: Construct, id: string, props: RedshiftConnectorProfileProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfile.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfile.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfile.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfileProps">RedshiftConnectorProfileProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.RedshiftConnectorProfile.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.RedshiftConnectorProfile.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.RedshiftConnectorProfile.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfileProps">RedshiftConnectorProfileProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfile.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfile.applyRemovalPolicy">applyRemovalPolicy</a></code> | Apply the given removal policy to this resource. |

---

##### `toString` <a name="toString" id="@cdklabs/cdk-appflow.RedshiftConnectorProfile.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `applyRemovalPolicy` <a name="applyRemovalPolicy" id="@cdklabs/cdk-appflow.RedshiftConnectorProfile.applyRemovalPolicy"></a>

```typescript
public applyRemovalPolicy(policy: RemovalPolicy): void
```

Apply the given removal policy to this resource.

The Removal Policy controls what happens to this resource when it stops
being managed by CloudFormation, either because you've removed it from the
CDK application or because you've made a change that requires the resource
to be replaced.

The resource can be deleted (`RemovalPolicy.DESTROY`), or left in your AWS
account for data recovery and cleanup later (`RemovalPolicy.RETAIN`).

###### `policy`<sup>Required</sup> <a name="policy" id="@cdklabs/cdk-appflow.RedshiftConnectorProfile.applyRemovalPolicy.parameter.policy"></a>

- *Type:* aws-cdk-lib.RemovalPolicy

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfile.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfile.isOwnedResource">isOwnedResource</a></code> | Returns true if the construct was created by CDK, and false otherwise. |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfile.isResource">isResource</a></code> | Check whether the given construct is a Resource. |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfile.fromConnectionProfileArn">fromConnectionProfileArn</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfile.fromConnectionProfileName">fromConnectionProfileName</a></code> | *No description.* |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="@cdklabs/cdk-appflow.RedshiftConnectorProfile.isConstruct"></a>

```typescript
import { RedshiftConnectorProfile } from '@cdklabs/cdk-appflow'

RedshiftConnectorProfile.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="@cdklabs/cdk-appflow.RedshiftConnectorProfile.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

##### `isOwnedResource` <a name="isOwnedResource" id="@cdklabs/cdk-appflow.RedshiftConnectorProfile.isOwnedResource"></a>

```typescript
import { RedshiftConnectorProfile } from '@cdklabs/cdk-appflow'

RedshiftConnectorProfile.isOwnedResource(construct: IConstruct)
```

Returns true if the construct was created by CDK, and false otherwise.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.RedshiftConnectorProfile.isOwnedResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `isResource` <a name="isResource" id="@cdklabs/cdk-appflow.RedshiftConnectorProfile.isResource"></a>

```typescript
import { RedshiftConnectorProfile } from '@cdklabs/cdk-appflow'

RedshiftConnectorProfile.isResource(construct: IConstruct)
```

Check whether the given construct is a Resource.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.RedshiftConnectorProfile.isResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `fromConnectionProfileArn` <a name="fromConnectionProfileArn" id="@cdklabs/cdk-appflow.RedshiftConnectorProfile.fromConnectionProfileArn"></a>

```typescript
import { RedshiftConnectorProfile } from '@cdklabs/cdk-appflow'

RedshiftConnectorProfile.fromConnectionProfileArn(scope: Construct, id: string, arn: string)
```

###### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.RedshiftConnectorProfile.fromConnectionProfileArn.parameter.scope"></a>

- *Type:* constructs.Construct

---

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.RedshiftConnectorProfile.fromConnectionProfileArn.parameter.id"></a>

- *Type:* string

---

###### `arn`<sup>Required</sup> <a name="arn" id="@cdklabs/cdk-appflow.RedshiftConnectorProfile.fromConnectionProfileArn.parameter.arn"></a>

- *Type:* string

---

##### `fromConnectionProfileName` <a name="fromConnectionProfileName" id="@cdklabs/cdk-appflow.RedshiftConnectorProfile.fromConnectionProfileName"></a>

```typescript
import { RedshiftConnectorProfile } from '@cdklabs/cdk-appflow'

RedshiftConnectorProfile.fromConnectionProfileName(scope: Construct, id: string, name: string)
```

###### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.RedshiftConnectorProfile.fromConnectionProfileName.parameter.scope"></a>

- *Type:* constructs.Construct

---

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.RedshiftConnectorProfile.fromConnectionProfileName.parameter.id"></a>

- *Type:* string

---

###### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.RedshiftConnectorProfile.fromConnectionProfileName.parameter.name"></a>

- *Type:* string

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfile.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfile.property.env">env</a></code> | <code>aws-cdk-lib.ResourceEnvironment</code> | The environment this resource belongs to. |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfile.property.stack">stack</a></code> | <code>aws-cdk-lib.Stack</code> | The stack in which this resource is defined. |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfile.property.arn">arn</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfile.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfile.property.credentials">credentials</a></code> | <code>aws-cdk-lib.aws_secretsmanager.ISecret</code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-appflow.RedshiftConnectorProfile.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `env`<sup>Required</sup> <a name="env" id="@cdklabs/cdk-appflow.RedshiftConnectorProfile.property.env"></a>

```typescript
public readonly env: ResourceEnvironment;
```

- *Type:* aws-cdk-lib.ResourceEnvironment

The environment this resource belongs to.

For resources that are created and managed by the CDK
(generally, those created by creating new class instances like Role, Bucket, etc.),
this is always the same as the environment of the stack they belong to;
however, for imported resources
(those obtained from static methods like fromRoleArn, fromBucketName, etc.),
that might be different than the stack they were imported into.

---

##### `stack`<sup>Required</sup> <a name="stack" id="@cdklabs/cdk-appflow.RedshiftConnectorProfile.property.stack"></a>

```typescript
public readonly stack: Stack;
```

- *Type:* aws-cdk-lib.Stack

The stack in which this resource is defined.

---

##### `arn`<sup>Required</sup> <a name="arn" id="@cdklabs/cdk-appflow.RedshiftConnectorProfile.property.arn"></a>

```typescript
public readonly arn: string;
```

- *Type:* string

---

##### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.RedshiftConnectorProfile.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `credentials`<sup>Optional</sup> <a name="credentials" id="@cdklabs/cdk-appflow.RedshiftConnectorProfile.property.credentials"></a>

```typescript
public readonly credentials: ISecret;
```

- *Type:* aws-cdk-lib.aws_secretsmanager.ISecret

---


### SalesforceConnectorProfile <a name="SalesforceConnectorProfile" id="@cdklabs/cdk-appflow.SalesforceConnectorProfile"></a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.SalesforceConnectorProfile.Initializer"></a>

```typescript
import { SalesforceConnectorProfile } from '@cdklabs/cdk-appflow'

new SalesforceConnectorProfile(scope: Construct, id: string, props: SalesforceConnectorProfileProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceConnectorProfile.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceConnectorProfile.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceConnectorProfile.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.SalesforceConnectorProfileProps">SalesforceConnectorProfileProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.SalesforceConnectorProfile.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.SalesforceConnectorProfile.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.SalesforceConnectorProfile.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.SalesforceConnectorProfileProps">SalesforceConnectorProfileProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceConnectorProfile.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceConnectorProfile.applyRemovalPolicy">applyRemovalPolicy</a></code> | Apply the given removal policy to this resource. |

---

##### `toString` <a name="toString" id="@cdklabs/cdk-appflow.SalesforceConnectorProfile.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `applyRemovalPolicy` <a name="applyRemovalPolicy" id="@cdklabs/cdk-appflow.SalesforceConnectorProfile.applyRemovalPolicy"></a>

```typescript
public applyRemovalPolicy(policy: RemovalPolicy): void
```

Apply the given removal policy to this resource.

The Removal Policy controls what happens to this resource when it stops
being managed by CloudFormation, either because you've removed it from the
CDK application or because you've made a change that requires the resource
to be replaced.

The resource can be deleted (`RemovalPolicy.DESTROY`), or left in your AWS
account for data recovery and cleanup later (`RemovalPolicy.RETAIN`).

###### `policy`<sup>Required</sup> <a name="policy" id="@cdklabs/cdk-appflow.SalesforceConnectorProfile.applyRemovalPolicy.parameter.policy"></a>

- *Type:* aws-cdk-lib.RemovalPolicy

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceConnectorProfile.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceConnectorProfile.isOwnedResource">isOwnedResource</a></code> | Returns true if the construct was created by CDK, and false otherwise. |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceConnectorProfile.isResource">isResource</a></code> | Check whether the given construct is a Resource. |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceConnectorProfile.fromConnectionProfileArn">fromConnectionProfileArn</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceConnectorProfile.fromConnectionProfileName">fromConnectionProfileName</a></code> | *No description.* |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="@cdklabs/cdk-appflow.SalesforceConnectorProfile.isConstruct"></a>

```typescript
import { SalesforceConnectorProfile } from '@cdklabs/cdk-appflow'

SalesforceConnectorProfile.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="@cdklabs/cdk-appflow.SalesforceConnectorProfile.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

##### `isOwnedResource` <a name="isOwnedResource" id="@cdklabs/cdk-appflow.SalesforceConnectorProfile.isOwnedResource"></a>

```typescript
import { SalesforceConnectorProfile } from '@cdklabs/cdk-appflow'

SalesforceConnectorProfile.isOwnedResource(construct: IConstruct)
```

Returns true if the construct was created by CDK, and false otherwise.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.SalesforceConnectorProfile.isOwnedResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `isResource` <a name="isResource" id="@cdklabs/cdk-appflow.SalesforceConnectorProfile.isResource"></a>

```typescript
import { SalesforceConnectorProfile } from '@cdklabs/cdk-appflow'

SalesforceConnectorProfile.isResource(construct: IConstruct)
```

Check whether the given construct is a Resource.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.SalesforceConnectorProfile.isResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `fromConnectionProfileArn` <a name="fromConnectionProfileArn" id="@cdklabs/cdk-appflow.SalesforceConnectorProfile.fromConnectionProfileArn"></a>

```typescript
import { SalesforceConnectorProfile } from '@cdklabs/cdk-appflow'

SalesforceConnectorProfile.fromConnectionProfileArn(scope: Construct, id: string, arn: string)
```

###### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.SalesforceConnectorProfile.fromConnectionProfileArn.parameter.scope"></a>

- *Type:* constructs.Construct

---

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.SalesforceConnectorProfile.fromConnectionProfileArn.parameter.id"></a>

- *Type:* string

---

###### `arn`<sup>Required</sup> <a name="arn" id="@cdklabs/cdk-appflow.SalesforceConnectorProfile.fromConnectionProfileArn.parameter.arn"></a>

- *Type:* string

---

##### `fromConnectionProfileName` <a name="fromConnectionProfileName" id="@cdklabs/cdk-appflow.SalesforceConnectorProfile.fromConnectionProfileName"></a>

```typescript
import { SalesforceConnectorProfile } from '@cdklabs/cdk-appflow'

SalesforceConnectorProfile.fromConnectionProfileName(scope: Construct, id: string, name: string)
```

###### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.SalesforceConnectorProfile.fromConnectionProfileName.parameter.scope"></a>

- *Type:* constructs.Construct

---

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.SalesforceConnectorProfile.fromConnectionProfileName.parameter.id"></a>

- *Type:* string

---

###### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.SalesforceConnectorProfile.fromConnectionProfileName.parameter.name"></a>

- *Type:* string

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceConnectorProfile.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceConnectorProfile.property.env">env</a></code> | <code>aws-cdk-lib.ResourceEnvironment</code> | The environment this resource belongs to. |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceConnectorProfile.property.stack">stack</a></code> | <code>aws-cdk-lib.Stack</code> | The stack in which this resource is defined. |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceConnectorProfile.property.arn">arn</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceConnectorProfile.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceConnectorProfile.property.credentials">credentials</a></code> | <code>aws-cdk-lib.aws_secretsmanager.ISecret</code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-appflow.SalesforceConnectorProfile.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `env`<sup>Required</sup> <a name="env" id="@cdklabs/cdk-appflow.SalesforceConnectorProfile.property.env"></a>

```typescript
public readonly env: ResourceEnvironment;
```

- *Type:* aws-cdk-lib.ResourceEnvironment

The environment this resource belongs to.

For resources that are created and managed by the CDK
(generally, those created by creating new class instances like Role, Bucket, etc.),
this is always the same as the environment of the stack they belong to;
however, for imported resources
(those obtained from static methods like fromRoleArn, fromBucketName, etc.),
that might be different than the stack they were imported into.

---

##### `stack`<sup>Required</sup> <a name="stack" id="@cdklabs/cdk-appflow.SalesforceConnectorProfile.property.stack"></a>

```typescript
public readonly stack: Stack;
```

- *Type:* aws-cdk-lib.Stack

The stack in which this resource is defined.

---

##### `arn`<sup>Required</sup> <a name="arn" id="@cdklabs/cdk-appflow.SalesforceConnectorProfile.property.arn"></a>

```typescript
public readonly arn: string;
```

- *Type:* string

---

##### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.SalesforceConnectorProfile.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `credentials`<sup>Optional</sup> <a name="credentials" id="@cdklabs/cdk-appflow.SalesforceConnectorProfile.property.credentials"></a>

```typescript
public readonly credentials: ISecret;
```

- *Type:* aws-cdk-lib.aws_secretsmanager.ISecret

---


### SalesforceMarketingCloudConnectorProfile <a name="SalesforceMarketingCloudConnectorProfile" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile"></a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.Initializer"></a>

```typescript
import { SalesforceMarketingCloudConnectorProfile } from '@cdklabs/cdk-appflow'

new SalesforceMarketingCloudConnectorProfile(scope: Construct, id: string, props: SalesforceMarketingCloudConnectorProfileProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfileProps">SalesforceMarketingCloudConnectorProfileProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfileProps">SalesforceMarketingCloudConnectorProfileProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.applyRemovalPolicy">applyRemovalPolicy</a></code> | Apply the given removal policy to this resource. |

---

##### `toString` <a name="toString" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `applyRemovalPolicy` <a name="applyRemovalPolicy" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.applyRemovalPolicy"></a>

```typescript
public applyRemovalPolicy(policy: RemovalPolicy): void
```

Apply the given removal policy to this resource.

The Removal Policy controls what happens to this resource when it stops
being managed by CloudFormation, either because you've removed it from the
CDK application or because you've made a change that requires the resource
to be replaced.

The resource can be deleted (`RemovalPolicy.DESTROY`), or left in your AWS
account for data recovery and cleanup later (`RemovalPolicy.RETAIN`).

###### `policy`<sup>Required</sup> <a name="policy" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.applyRemovalPolicy.parameter.policy"></a>

- *Type:* aws-cdk-lib.RemovalPolicy

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.isOwnedResource">isOwnedResource</a></code> | Returns true if the construct was created by CDK, and false otherwise. |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.isResource">isResource</a></code> | Check whether the given construct is a Resource. |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.fromConnectionProfileArn">fromConnectionProfileArn</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.fromConnectionProfileName">fromConnectionProfileName</a></code> | *No description.* |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.isConstruct"></a>

```typescript
import { SalesforceMarketingCloudConnectorProfile } from '@cdklabs/cdk-appflow'

SalesforceMarketingCloudConnectorProfile.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

##### `isOwnedResource` <a name="isOwnedResource" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.isOwnedResource"></a>

```typescript
import { SalesforceMarketingCloudConnectorProfile } from '@cdklabs/cdk-appflow'

SalesforceMarketingCloudConnectorProfile.isOwnedResource(construct: IConstruct)
```

Returns true if the construct was created by CDK, and false otherwise.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.isOwnedResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `isResource` <a name="isResource" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.isResource"></a>

```typescript
import { SalesforceMarketingCloudConnectorProfile } from '@cdklabs/cdk-appflow'

SalesforceMarketingCloudConnectorProfile.isResource(construct: IConstruct)
```

Check whether the given construct is a Resource.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.isResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `fromConnectionProfileArn` <a name="fromConnectionProfileArn" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.fromConnectionProfileArn"></a>

```typescript
import { SalesforceMarketingCloudConnectorProfile } from '@cdklabs/cdk-appflow'

SalesforceMarketingCloudConnectorProfile.fromConnectionProfileArn(scope: Construct, id: string, arn: string)
```

###### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.fromConnectionProfileArn.parameter.scope"></a>

- *Type:* constructs.Construct

---

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.fromConnectionProfileArn.parameter.id"></a>

- *Type:* string

---

###### `arn`<sup>Required</sup> <a name="arn" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.fromConnectionProfileArn.parameter.arn"></a>

- *Type:* string

---

##### `fromConnectionProfileName` <a name="fromConnectionProfileName" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.fromConnectionProfileName"></a>

```typescript
import { SalesforceMarketingCloudConnectorProfile } from '@cdklabs/cdk-appflow'

SalesforceMarketingCloudConnectorProfile.fromConnectionProfileName(scope: Construct, id: string, name: string)
```

###### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.fromConnectionProfileName.parameter.scope"></a>

- *Type:* constructs.Construct

---

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.fromConnectionProfileName.parameter.id"></a>

- *Type:* string

---

###### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.fromConnectionProfileName.parameter.name"></a>

- *Type:* string

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.property.env">env</a></code> | <code>aws-cdk-lib.ResourceEnvironment</code> | The environment this resource belongs to. |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.property.stack">stack</a></code> | <code>aws-cdk-lib.Stack</code> | The stack in which this resource is defined. |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.property.arn">arn</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.property.credentials">credentials</a></code> | <code>aws-cdk-lib.aws_secretsmanager.ISecret</code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `env`<sup>Required</sup> <a name="env" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.property.env"></a>

```typescript
public readonly env: ResourceEnvironment;
```

- *Type:* aws-cdk-lib.ResourceEnvironment

The environment this resource belongs to.

For resources that are created and managed by the CDK
(generally, those created by creating new class instances like Role, Bucket, etc.),
this is always the same as the environment of the stack they belong to;
however, for imported resources
(those obtained from static methods like fromRoleArn, fromBucketName, etc.),
that might be different than the stack they were imported into.

---

##### `stack`<sup>Required</sup> <a name="stack" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.property.stack"></a>

```typescript
public readonly stack: Stack;
```

- *Type:* aws-cdk-lib.Stack

The stack in which this resource is defined.

---

##### `arn`<sup>Required</sup> <a name="arn" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.property.arn"></a>

```typescript
public readonly arn: string;
```

- *Type:* string

---

##### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `credentials`<sup>Optional</sup> <a name="credentials" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile.property.credentials"></a>

```typescript
public readonly credentials: ISecret;
```

- *Type:* aws-cdk-lib.aws_secretsmanager.ISecret

---


### SAPOdataConnectorProfile <a name="SAPOdataConnectorProfile" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfile"></a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfile.Initializer"></a>

```typescript
import { SAPOdataConnectorProfile } from '@cdklabs/cdk-appflow'

new SAPOdataConnectorProfile(scope: Construct, id: string, props: SAPOdataConnectorProfileProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfile.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfile.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfile.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfileProps">SAPOdataConnectorProfileProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfile.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfile.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfile.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfileProps">SAPOdataConnectorProfileProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfile.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfile.applyRemovalPolicy">applyRemovalPolicy</a></code> | Apply the given removal policy to this resource. |

---

##### `toString` <a name="toString" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfile.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `applyRemovalPolicy` <a name="applyRemovalPolicy" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfile.applyRemovalPolicy"></a>

```typescript
public applyRemovalPolicy(policy: RemovalPolicy): void
```

Apply the given removal policy to this resource.

The Removal Policy controls what happens to this resource when it stops
being managed by CloudFormation, either because you've removed it from the
CDK application or because you've made a change that requires the resource
to be replaced.

The resource can be deleted (`RemovalPolicy.DESTROY`), or left in your AWS
account for data recovery and cleanup later (`RemovalPolicy.RETAIN`).

###### `policy`<sup>Required</sup> <a name="policy" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfile.applyRemovalPolicy.parameter.policy"></a>

- *Type:* aws-cdk-lib.RemovalPolicy

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfile.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfile.isOwnedResource">isOwnedResource</a></code> | Returns true if the construct was created by CDK, and false otherwise. |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfile.isResource">isResource</a></code> | Check whether the given construct is a Resource. |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfile.fromConnectionProfileArn">fromConnectionProfileArn</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfile.fromConnectionProfileName">fromConnectionProfileName</a></code> | *No description.* |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfile.isConstruct"></a>

```typescript
import { SAPOdataConnectorProfile } from '@cdklabs/cdk-appflow'

SAPOdataConnectorProfile.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfile.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

##### `isOwnedResource` <a name="isOwnedResource" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfile.isOwnedResource"></a>

```typescript
import { SAPOdataConnectorProfile } from '@cdklabs/cdk-appflow'

SAPOdataConnectorProfile.isOwnedResource(construct: IConstruct)
```

Returns true if the construct was created by CDK, and false otherwise.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfile.isOwnedResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `isResource` <a name="isResource" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfile.isResource"></a>

```typescript
import { SAPOdataConnectorProfile } from '@cdklabs/cdk-appflow'

SAPOdataConnectorProfile.isResource(construct: IConstruct)
```

Check whether the given construct is a Resource.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfile.isResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `fromConnectionProfileArn` <a name="fromConnectionProfileArn" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfile.fromConnectionProfileArn"></a>

```typescript
import { SAPOdataConnectorProfile } from '@cdklabs/cdk-appflow'

SAPOdataConnectorProfile.fromConnectionProfileArn(scope: Construct, id: string, arn: string)
```

###### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfile.fromConnectionProfileArn.parameter.scope"></a>

- *Type:* constructs.Construct

---

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfile.fromConnectionProfileArn.parameter.id"></a>

- *Type:* string

---

###### `arn`<sup>Required</sup> <a name="arn" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfile.fromConnectionProfileArn.parameter.arn"></a>

- *Type:* string

---

##### `fromConnectionProfileName` <a name="fromConnectionProfileName" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfile.fromConnectionProfileName"></a>

```typescript
import { SAPOdataConnectorProfile } from '@cdklabs/cdk-appflow'

SAPOdataConnectorProfile.fromConnectionProfileName(scope: Construct, id: string, name: string)
```

###### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfile.fromConnectionProfileName.parameter.scope"></a>

- *Type:* constructs.Construct

---

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfile.fromConnectionProfileName.parameter.id"></a>

- *Type:* string

---

###### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfile.fromConnectionProfileName.parameter.name"></a>

- *Type:* string

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfile.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfile.property.env">env</a></code> | <code>aws-cdk-lib.ResourceEnvironment</code> | The environment this resource belongs to. |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfile.property.stack">stack</a></code> | <code>aws-cdk-lib.Stack</code> | The stack in which this resource is defined. |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfile.property.arn">arn</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfile.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfile.property.credentials">credentials</a></code> | <code>aws-cdk-lib.aws_secretsmanager.ISecret</code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfile.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `env`<sup>Required</sup> <a name="env" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfile.property.env"></a>

```typescript
public readonly env: ResourceEnvironment;
```

- *Type:* aws-cdk-lib.ResourceEnvironment

The environment this resource belongs to.

For resources that are created and managed by the CDK
(generally, those created by creating new class instances like Role, Bucket, etc.),
this is always the same as the environment of the stack they belong to;
however, for imported resources
(those obtained from static methods like fromRoleArn, fromBucketName, etc.),
that might be different than the stack they were imported into.

---

##### `stack`<sup>Required</sup> <a name="stack" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfile.property.stack"></a>

```typescript
public readonly stack: Stack;
```

- *Type:* aws-cdk-lib.Stack

The stack in which this resource is defined.

---

##### `arn`<sup>Required</sup> <a name="arn" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfile.property.arn"></a>

```typescript
public readonly arn: string;
```

- *Type:* string

---

##### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfile.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `credentials`<sup>Optional</sup> <a name="credentials" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfile.property.credentials"></a>

```typescript
public readonly credentials: ISecret;
```

- *Type:* aws-cdk-lib.aws_secretsmanager.ISecret

---


### ServiceNowConnectorProfile <a name="ServiceNowConnectorProfile" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfile"></a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfile.Initializer"></a>

```typescript
import { ServiceNowConnectorProfile } from '@cdklabs/cdk-appflow'

new ServiceNowConnectorProfile(scope: Construct, id: string, props: ServiceNowConnectorProfileProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ServiceNowConnectorProfile.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ServiceNowConnectorProfile.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ServiceNowConnectorProfile.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.ServiceNowConnectorProfileProps">ServiceNowConnectorProfileProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfile.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfile.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfile.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.ServiceNowConnectorProfileProps">ServiceNowConnectorProfileProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ServiceNowConnectorProfile.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@cdklabs/cdk-appflow.ServiceNowConnectorProfile.applyRemovalPolicy">applyRemovalPolicy</a></code> | Apply the given removal policy to this resource. |

---

##### `toString` <a name="toString" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfile.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `applyRemovalPolicy` <a name="applyRemovalPolicy" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfile.applyRemovalPolicy"></a>

```typescript
public applyRemovalPolicy(policy: RemovalPolicy): void
```

Apply the given removal policy to this resource.

The Removal Policy controls what happens to this resource when it stops
being managed by CloudFormation, either because you've removed it from the
CDK application or because you've made a change that requires the resource
to be replaced.

The resource can be deleted (`RemovalPolicy.DESTROY`), or left in your AWS
account for data recovery and cleanup later (`RemovalPolicy.RETAIN`).

###### `policy`<sup>Required</sup> <a name="policy" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfile.applyRemovalPolicy.parameter.policy"></a>

- *Type:* aws-cdk-lib.RemovalPolicy

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ServiceNowConnectorProfile.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |
| <code><a href="#@cdklabs/cdk-appflow.ServiceNowConnectorProfile.isOwnedResource">isOwnedResource</a></code> | Returns true if the construct was created by CDK, and false otherwise. |
| <code><a href="#@cdklabs/cdk-appflow.ServiceNowConnectorProfile.isResource">isResource</a></code> | Check whether the given construct is a Resource. |
| <code><a href="#@cdklabs/cdk-appflow.ServiceNowConnectorProfile.fromConnectionProfileArn">fromConnectionProfileArn</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ServiceNowConnectorProfile.fromConnectionProfileName">fromConnectionProfileName</a></code> | *No description.* |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfile.isConstruct"></a>

```typescript
import { ServiceNowConnectorProfile } from '@cdklabs/cdk-appflow'

ServiceNowConnectorProfile.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfile.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

##### `isOwnedResource` <a name="isOwnedResource" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfile.isOwnedResource"></a>

```typescript
import { ServiceNowConnectorProfile } from '@cdklabs/cdk-appflow'

ServiceNowConnectorProfile.isOwnedResource(construct: IConstruct)
```

Returns true if the construct was created by CDK, and false otherwise.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfile.isOwnedResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `isResource` <a name="isResource" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfile.isResource"></a>

```typescript
import { ServiceNowConnectorProfile } from '@cdklabs/cdk-appflow'

ServiceNowConnectorProfile.isResource(construct: IConstruct)
```

Check whether the given construct is a Resource.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfile.isResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `fromConnectionProfileArn` <a name="fromConnectionProfileArn" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfile.fromConnectionProfileArn"></a>

```typescript
import { ServiceNowConnectorProfile } from '@cdklabs/cdk-appflow'

ServiceNowConnectorProfile.fromConnectionProfileArn(scope: Construct, id: string, arn: string)
```

###### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfile.fromConnectionProfileArn.parameter.scope"></a>

- *Type:* constructs.Construct

---

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfile.fromConnectionProfileArn.parameter.id"></a>

- *Type:* string

---

###### `arn`<sup>Required</sup> <a name="arn" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfile.fromConnectionProfileArn.parameter.arn"></a>

- *Type:* string

---

##### `fromConnectionProfileName` <a name="fromConnectionProfileName" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfile.fromConnectionProfileName"></a>

```typescript
import { ServiceNowConnectorProfile } from '@cdklabs/cdk-appflow'

ServiceNowConnectorProfile.fromConnectionProfileName(scope: Construct, id: string, name: string)
```

###### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfile.fromConnectionProfileName.parameter.scope"></a>

- *Type:* constructs.Construct

---

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfile.fromConnectionProfileName.parameter.id"></a>

- *Type:* string

---

###### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfile.fromConnectionProfileName.parameter.name"></a>

- *Type:* string

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ServiceNowConnectorProfile.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@cdklabs/cdk-appflow.ServiceNowConnectorProfile.property.env">env</a></code> | <code>aws-cdk-lib.ResourceEnvironment</code> | The environment this resource belongs to. |
| <code><a href="#@cdklabs/cdk-appflow.ServiceNowConnectorProfile.property.stack">stack</a></code> | <code>aws-cdk-lib.Stack</code> | The stack in which this resource is defined. |
| <code><a href="#@cdklabs/cdk-appflow.ServiceNowConnectorProfile.property.arn">arn</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ServiceNowConnectorProfile.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ServiceNowConnectorProfile.property.credentials">credentials</a></code> | <code>aws-cdk-lib.aws_secretsmanager.ISecret</code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfile.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `env`<sup>Required</sup> <a name="env" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfile.property.env"></a>

```typescript
public readonly env: ResourceEnvironment;
```

- *Type:* aws-cdk-lib.ResourceEnvironment

The environment this resource belongs to.

For resources that are created and managed by the CDK
(generally, those created by creating new class instances like Role, Bucket, etc.),
this is always the same as the environment of the stack they belong to;
however, for imported resources
(those obtained from static methods like fromRoleArn, fromBucketName, etc.),
that might be different than the stack they were imported into.

---

##### `stack`<sup>Required</sup> <a name="stack" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfile.property.stack"></a>

```typescript
public readonly stack: Stack;
```

- *Type:* aws-cdk-lib.Stack

The stack in which this resource is defined.

---

##### `arn`<sup>Required</sup> <a name="arn" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfile.property.arn"></a>

```typescript
public readonly arn: string;
```

- *Type:* string

---

##### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfile.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `credentials`<sup>Optional</sup> <a name="credentials" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfile.property.credentials"></a>

```typescript
public readonly credentials: ISecret;
```

- *Type:* aws-cdk-lib.aws_secretsmanager.ISecret

---


### SlackConnectorProfile <a name="SlackConnectorProfile" id="@cdklabs/cdk-appflow.SlackConnectorProfile"></a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.SlackConnectorProfile.Initializer"></a>

```typescript
import { SlackConnectorProfile } from '@cdklabs/cdk-appflow'

new SlackConnectorProfile(scope: Construct, id: string, props: SlackConnectorProfileProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SlackConnectorProfile.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SlackConnectorProfile.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SlackConnectorProfile.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.SlackConnectorProfileProps">SlackConnectorProfileProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.SlackConnectorProfile.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.SlackConnectorProfile.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.SlackConnectorProfile.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.SlackConnectorProfileProps">SlackConnectorProfileProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SlackConnectorProfile.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@cdklabs/cdk-appflow.SlackConnectorProfile.applyRemovalPolicy">applyRemovalPolicy</a></code> | Apply the given removal policy to this resource. |

---

##### `toString` <a name="toString" id="@cdklabs/cdk-appflow.SlackConnectorProfile.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `applyRemovalPolicy` <a name="applyRemovalPolicy" id="@cdklabs/cdk-appflow.SlackConnectorProfile.applyRemovalPolicy"></a>

```typescript
public applyRemovalPolicy(policy: RemovalPolicy): void
```

Apply the given removal policy to this resource.

The Removal Policy controls what happens to this resource when it stops
being managed by CloudFormation, either because you've removed it from the
CDK application or because you've made a change that requires the resource
to be replaced.

The resource can be deleted (`RemovalPolicy.DESTROY`), or left in your AWS
account for data recovery and cleanup later (`RemovalPolicy.RETAIN`).

###### `policy`<sup>Required</sup> <a name="policy" id="@cdklabs/cdk-appflow.SlackConnectorProfile.applyRemovalPolicy.parameter.policy"></a>

- *Type:* aws-cdk-lib.RemovalPolicy

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SlackConnectorProfile.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |
| <code><a href="#@cdklabs/cdk-appflow.SlackConnectorProfile.isOwnedResource">isOwnedResource</a></code> | Returns true if the construct was created by CDK, and false otherwise. |
| <code><a href="#@cdklabs/cdk-appflow.SlackConnectorProfile.isResource">isResource</a></code> | Check whether the given construct is a Resource. |
| <code><a href="#@cdklabs/cdk-appflow.SlackConnectorProfile.fromConnectionProfileArn">fromConnectionProfileArn</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SlackConnectorProfile.fromConnectionProfileName">fromConnectionProfileName</a></code> | *No description.* |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="@cdklabs/cdk-appflow.SlackConnectorProfile.isConstruct"></a>

```typescript
import { SlackConnectorProfile } from '@cdklabs/cdk-appflow'

SlackConnectorProfile.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="@cdklabs/cdk-appflow.SlackConnectorProfile.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

##### `isOwnedResource` <a name="isOwnedResource" id="@cdklabs/cdk-appflow.SlackConnectorProfile.isOwnedResource"></a>

```typescript
import { SlackConnectorProfile } from '@cdklabs/cdk-appflow'

SlackConnectorProfile.isOwnedResource(construct: IConstruct)
```

Returns true if the construct was created by CDK, and false otherwise.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.SlackConnectorProfile.isOwnedResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `isResource` <a name="isResource" id="@cdklabs/cdk-appflow.SlackConnectorProfile.isResource"></a>

```typescript
import { SlackConnectorProfile } from '@cdklabs/cdk-appflow'

SlackConnectorProfile.isResource(construct: IConstruct)
```

Check whether the given construct is a Resource.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.SlackConnectorProfile.isResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `fromConnectionProfileArn` <a name="fromConnectionProfileArn" id="@cdklabs/cdk-appflow.SlackConnectorProfile.fromConnectionProfileArn"></a>

```typescript
import { SlackConnectorProfile } from '@cdklabs/cdk-appflow'

SlackConnectorProfile.fromConnectionProfileArn(scope: Construct, id: string, arn: string)
```

###### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.SlackConnectorProfile.fromConnectionProfileArn.parameter.scope"></a>

- *Type:* constructs.Construct

---

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.SlackConnectorProfile.fromConnectionProfileArn.parameter.id"></a>

- *Type:* string

---

###### `arn`<sup>Required</sup> <a name="arn" id="@cdklabs/cdk-appflow.SlackConnectorProfile.fromConnectionProfileArn.parameter.arn"></a>

- *Type:* string

---

##### `fromConnectionProfileName` <a name="fromConnectionProfileName" id="@cdklabs/cdk-appflow.SlackConnectorProfile.fromConnectionProfileName"></a>

```typescript
import { SlackConnectorProfile } from '@cdklabs/cdk-appflow'

SlackConnectorProfile.fromConnectionProfileName(scope: Construct, id: string, name: string)
```

###### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.SlackConnectorProfile.fromConnectionProfileName.parameter.scope"></a>

- *Type:* constructs.Construct

---

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.SlackConnectorProfile.fromConnectionProfileName.parameter.id"></a>

- *Type:* string

---

###### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.SlackConnectorProfile.fromConnectionProfileName.parameter.name"></a>

- *Type:* string

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SlackConnectorProfile.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@cdklabs/cdk-appflow.SlackConnectorProfile.property.env">env</a></code> | <code>aws-cdk-lib.ResourceEnvironment</code> | The environment this resource belongs to. |
| <code><a href="#@cdklabs/cdk-appflow.SlackConnectorProfile.property.stack">stack</a></code> | <code>aws-cdk-lib.Stack</code> | The stack in which this resource is defined. |
| <code><a href="#@cdklabs/cdk-appflow.SlackConnectorProfile.property.arn">arn</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SlackConnectorProfile.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SlackConnectorProfile.property.credentials">credentials</a></code> | <code>aws-cdk-lib.aws_secretsmanager.ISecret</code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-appflow.SlackConnectorProfile.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `env`<sup>Required</sup> <a name="env" id="@cdklabs/cdk-appflow.SlackConnectorProfile.property.env"></a>

```typescript
public readonly env: ResourceEnvironment;
```

- *Type:* aws-cdk-lib.ResourceEnvironment

The environment this resource belongs to.

For resources that are created and managed by the CDK
(generally, those created by creating new class instances like Role, Bucket, etc.),
this is always the same as the environment of the stack they belong to;
however, for imported resources
(those obtained from static methods like fromRoleArn, fromBucketName, etc.),
that might be different than the stack they were imported into.

---

##### `stack`<sup>Required</sup> <a name="stack" id="@cdklabs/cdk-appflow.SlackConnectorProfile.property.stack"></a>

```typescript
public readonly stack: Stack;
```

- *Type:* aws-cdk-lib.Stack

The stack in which this resource is defined.

---

##### `arn`<sup>Required</sup> <a name="arn" id="@cdklabs/cdk-appflow.SlackConnectorProfile.property.arn"></a>

```typescript
public readonly arn: string;
```

- *Type:* string

---

##### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.SlackConnectorProfile.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `credentials`<sup>Optional</sup> <a name="credentials" id="@cdklabs/cdk-appflow.SlackConnectorProfile.property.credentials"></a>

```typescript
public readonly credentials: ISecret;
```

- *Type:* aws-cdk-lib.aws_secretsmanager.ISecret

---


### TriggeredFlowBase <a name="TriggeredFlowBase" id="@cdklabs/cdk-appflow.TriggeredFlowBase"></a>

- *Implements:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.TriggeredFlowBase.Initializer"></a>

```typescript
import { TriggeredFlowBase } from '@cdklabs/cdk-appflow'

new TriggeredFlowBase(scope: Construct, id: string, props: FlowBaseProps, autoActivate?: boolean)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBase.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBase.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBase.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.FlowBaseProps">FlowBaseProps</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBase.Initializer.parameter.autoActivate">autoActivate</a></code> | <code>boolean</code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.TriggeredFlowBase.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.TriggeredFlowBase.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.TriggeredFlowBase.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.FlowBaseProps">FlowBaseProps</a>

---

##### `autoActivate`<sup>Optional</sup> <a name="autoActivate" id="@cdklabs/cdk-appflow.TriggeredFlowBase.Initializer.parameter.autoActivate"></a>

- *Type:* boolean

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBase.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBase.applyRemovalPolicy">applyRemovalPolicy</a></code> | Apply the given removal policy to this resource. |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBase.onEvent">onEvent</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBase.onRunCompleted">onRunCompleted</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBase.onRunStarted">onRunStarted</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBase.onDeactivated">onDeactivated</a></code> | *No description.* |

---

##### `toString` <a name="toString" id="@cdklabs/cdk-appflow.TriggeredFlowBase.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `applyRemovalPolicy` <a name="applyRemovalPolicy" id="@cdklabs/cdk-appflow.TriggeredFlowBase.applyRemovalPolicy"></a>

```typescript
public applyRemovalPolicy(policy: RemovalPolicy): void
```

Apply the given removal policy to this resource.

The Removal Policy controls what happens to this resource when it stops
being managed by CloudFormation, either because you've removed it from the
CDK application or because you've made a change that requires the resource
to be replaced.

The resource can be deleted (`RemovalPolicy.DESTROY`), or left in your AWS
account for data recovery and cleanup later (`RemovalPolicy.RETAIN`).

###### `policy`<sup>Required</sup> <a name="policy" id="@cdklabs/cdk-appflow.TriggeredFlowBase.applyRemovalPolicy.parameter.policy"></a>

- *Type:* aws-cdk-lib.RemovalPolicy

---

##### `onEvent` <a name="onEvent" id="@cdklabs/cdk-appflow.TriggeredFlowBase.onEvent"></a>

```typescript
public onEvent(id: string, options?: OnEventOptions): Rule
```

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.TriggeredFlowBase.onEvent.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Optional</sup> <a name="options" id="@cdklabs/cdk-appflow.TriggeredFlowBase.onEvent.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_events.OnEventOptions

---

##### `onRunCompleted` <a name="onRunCompleted" id="@cdklabs/cdk-appflow.TriggeredFlowBase.onRunCompleted"></a>

```typescript
public onRunCompleted(id: string, options?: OnEventOptions): Rule
```

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.TriggeredFlowBase.onRunCompleted.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Optional</sup> <a name="options" id="@cdklabs/cdk-appflow.TriggeredFlowBase.onRunCompleted.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_events.OnEventOptions

---

##### `onRunStarted` <a name="onRunStarted" id="@cdklabs/cdk-appflow.TriggeredFlowBase.onRunStarted"></a>

```typescript
public onRunStarted(id: string, options?: OnEventOptions): Rule
```

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.TriggeredFlowBase.onRunStarted.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Optional</sup> <a name="options" id="@cdklabs/cdk-appflow.TriggeredFlowBase.onRunStarted.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_events.OnEventOptions

---

##### `onDeactivated` <a name="onDeactivated" id="@cdklabs/cdk-appflow.TriggeredFlowBase.onDeactivated"></a>

```typescript
public onDeactivated(id: string, options?: OnEventOptions): Rule
```

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.TriggeredFlowBase.onDeactivated.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Optional</sup> <a name="options" id="@cdklabs/cdk-appflow.TriggeredFlowBase.onDeactivated.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_events.OnEventOptions

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBase.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBase.isOwnedResource">isOwnedResource</a></code> | Returns true if the construct was created by CDK, and false otherwise. |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBase.isResource">isResource</a></code> | Check whether the given construct is a Resource. |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="@cdklabs/cdk-appflow.TriggeredFlowBase.isConstruct"></a>

```typescript
import { TriggeredFlowBase } from '@cdklabs/cdk-appflow'

TriggeredFlowBase.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="@cdklabs/cdk-appflow.TriggeredFlowBase.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

##### `isOwnedResource` <a name="isOwnedResource" id="@cdklabs/cdk-appflow.TriggeredFlowBase.isOwnedResource"></a>

```typescript
import { TriggeredFlowBase } from '@cdklabs/cdk-appflow'

TriggeredFlowBase.isOwnedResource(construct: IConstruct)
```

Returns true if the construct was created by CDK, and false otherwise.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.TriggeredFlowBase.isOwnedResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `isResource` <a name="isResource" id="@cdklabs/cdk-appflow.TriggeredFlowBase.isResource"></a>

```typescript
import { TriggeredFlowBase } from '@cdklabs/cdk-appflow'

TriggeredFlowBase.isResource(construct: IConstruct)
```

Check whether the given construct is a Resource.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.TriggeredFlowBase.isResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBase.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBase.property.env">env</a></code> | <code>aws-cdk-lib.ResourceEnvironment</code> | The environment this resource belongs to. |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBase.property.stack">stack</a></code> | <code>aws-cdk-lib.Stack</code> | The stack in which this resource is defined. |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBase.property.arn">arn</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBase.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBase.property.type">type</a></code> | <code><a href="#@cdklabs/cdk-appflow.FlowType">FlowType</a></code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-appflow.TriggeredFlowBase.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `env`<sup>Required</sup> <a name="env" id="@cdklabs/cdk-appflow.TriggeredFlowBase.property.env"></a>

```typescript
public readonly env: ResourceEnvironment;
```

- *Type:* aws-cdk-lib.ResourceEnvironment

The environment this resource belongs to.

For resources that are created and managed by the CDK
(generally, those created by creating new class instances like Role, Bucket, etc.),
this is always the same as the environment of the stack they belong to;
however, for imported resources
(those obtained from static methods like fromRoleArn, fromBucketName, etc.),
that might be different than the stack they were imported into.

---

##### `stack`<sup>Required</sup> <a name="stack" id="@cdklabs/cdk-appflow.TriggeredFlowBase.property.stack"></a>

```typescript
public readonly stack: Stack;
```

- *Type:* aws-cdk-lib.Stack

The stack in which this resource is defined.

---

##### `arn`<sup>Required</sup> <a name="arn" id="@cdklabs/cdk-appflow.TriggeredFlowBase.property.arn"></a>

```typescript
public readonly arn: string;
```

- *Type:* string

---

##### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.TriggeredFlowBase.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `type`<sup>Required</sup> <a name="type" id="@cdklabs/cdk-appflow.TriggeredFlowBase.property.type"></a>

```typescript
public readonly type: FlowType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.FlowType">FlowType</a>

---


### ZendeskConnectorProfile <a name="ZendeskConnectorProfile" id="@cdklabs/cdk-appflow.ZendeskConnectorProfile"></a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.ZendeskConnectorProfile.Initializer"></a>

```typescript
import { ZendeskConnectorProfile } from '@cdklabs/cdk-appflow'

new ZendeskConnectorProfile(scope: Construct, id: string, props: ZendeskConnectorProfileProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskConnectorProfile.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskConnectorProfile.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskConnectorProfile.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.ZendeskConnectorProfileProps">ZendeskConnectorProfileProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.ZendeskConnectorProfile.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.ZendeskConnectorProfile.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.ZendeskConnectorProfile.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.ZendeskConnectorProfileProps">ZendeskConnectorProfileProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskConnectorProfile.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskConnectorProfile.applyRemovalPolicy">applyRemovalPolicy</a></code> | Apply the given removal policy to this resource. |

---

##### `toString` <a name="toString" id="@cdklabs/cdk-appflow.ZendeskConnectorProfile.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `applyRemovalPolicy` <a name="applyRemovalPolicy" id="@cdklabs/cdk-appflow.ZendeskConnectorProfile.applyRemovalPolicy"></a>

```typescript
public applyRemovalPolicy(policy: RemovalPolicy): void
```

Apply the given removal policy to this resource.

The Removal Policy controls what happens to this resource when it stops
being managed by CloudFormation, either because you've removed it from the
CDK application or because you've made a change that requires the resource
to be replaced.

The resource can be deleted (`RemovalPolicy.DESTROY`), or left in your AWS
account for data recovery and cleanup later (`RemovalPolicy.RETAIN`).

###### `policy`<sup>Required</sup> <a name="policy" id="@cdklabs/cdk-appflow.ZendeskConnectorProfile.applyRemovalPolicy.parameter.policy"></a>

- *Type:* aws-cdk-lib.RemovalPolicy

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskConnectorProfile.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskConnectorProfile.isOwnedResource">isOwnedResource</a></code> | Returns true if the construct was created by CDK, and false otherwise. |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskConnectorProfile.isResource">isResource</a></code> | Check whether the given construct is a Resource. |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskConnectorProfile.fromConnectionProfileArn">fromConnectionProfileArn</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskConnectorProfile.fromConnectionProfileName">fromConnectionProfileName</a></code> | *No description.* |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="@cdklabs/cdk-appflow.ZendeskConnectorProfile.isConstruct"></a>

```typescript
import { ZendeskConnectorProfile } from '@cdklabs/cdk-appflow'

ZendeskConnectorProfile.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="@cdklabs/cdk-appflow.ZendeskConnectorProfile.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

##### `isOwnedResource` <a name="isOwnedResource" id="@cdklabs/cdk-appflow.ZendeskConnectorProfile.isOwnedResource"></a>

```typescript
import { ZendeskConnectorProfile } from '@cdklabs/cdk-appflow'

ZendeskConnectorProfile.isOwnedResource(construct: IConstruct)
```

Returns true if the construct was created by CDK, and false otherwise.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.ZendeskConnectorProfile.isOwnedResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `isResource` <a name="isResource" id="@cdklabs/cdk-appflow.ZendeskConnectorProfile.isResource"></a>

```typescript
import { ZendeskConnectorProfile } from '@cdklabs/cdk-appflow'

ZendeskConnectorProfile.isResource(construct: IConstruct)
```

Check whether the given construct is a Resource.

###### `construct`<sup>Required</sup> <a name="construct" id="@cdklabs/cdk-appflow.ZendeskConnectorProfile.isResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `fromConnectionProfileArn` <a name="fromConnectionProfileArn" id="@cdklabs/cdk-appflow.ZendeskConnectorProfile.fromConnectionProfileArn"></a>

```typescript
import { ZendeskConnectorProfile } from '@cdklabs/cdk-appflow'

ZendeskConnectorProfile.fromConnectionProfileArn(scope: Construct, id: string, arn: string)
```

###### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.ZendeskConnectorProfile.fromConnectionProfileArn.parameter.scope"></a>

- *Type:* constructs.Construct

---

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.ZendeskConnectorProfile.fromConnectionProfileArn.parameter.id"></a>

- *Type:* string

---

###### `arn`<sup>Required</sup> <a name="arn" id="@cdklabs/cdk-appflow.ZendeskConnectorProfile.fromConnectionProfileArn.parameter.arn"></a>

- *Type:* string

---

##### `fromConnectionProfileName` <a name="fromConnectionProfileName" id="@cdklabs/cdk-appflow.ZendeskConnectorProfile.fromConnectionProfileName"></a>

```typescript
import { ZendeskConnectorProfile } from '@cdklabs/cdk-appflow'

ZendeskConnectorProfile.fromConnectionProfileName(scope: Construct, id: string, name: string)
```

###### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.ZendeskConnectorProfile.fromConnectionProfileName.parameter.scope"></a>

- *Type:* constructs.Construct

---

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.ZendeskConnectorProfile.fromConnectionProfileName.parameter.id"></a>

- *Type:* string

---

###### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.ZendeskConnectorProfile.fromConnectionProfileName.parameter.name"></a>

- *Type:* string

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskConnectorProfile.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskConnectorProfile.property.env">env</a></code> | <code>aws-cdk-lib.ResourceEnvironment</code> | The environment this resource belongs to. |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskConnectorProfile.property.stack">stack</a></code> | <code>aws-cdk-lib.Stack</code> | The stack in which this resource is defined. |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskConnectorProfile.property.arn">arn</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskConnectorProfile.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskConnectorProfile.property.credentials">credentials</a></code> | <code>aws-cdk-lib.aws_secretsmanager.ISecret</code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-appflow.ZendeskConnectorProfile.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `env`<sup>Required</sup> <a name="env" id="@cdklabs/cdk-appflow.ZendeskConnectorProfile.property.env"></a>

```typescript
public readonly env: ResourceEnvironment;
```

- *Type:* aws-cdk-lib.ResourceEnvironment

The environment this resource belongs to.

For resources that are created and managed by the CDK
(generally, those created by creating new class instances like Role, Bucket, etc.),
this is always the same as the environment of the stack they belong to;
however, for imported resources
(those obtained from static methods like fromRoleArn, fromBucketName, etc.),
that might be different than the stack they were imported into.

---

##### `stack`<sup>Required</sup> <a name="stack" id="@cdklabs/cdk-appflow.ZendeskConnectorProfile.property.stack"></a>

```typescript
public readonly stack: Stack;
```

- *Type:* aws-cdk-lib.Stack

The stack in which this resource is defined.

---

##### `arn`<sup>Required</sup> <a name="arn" id="@cdklabs/cdk-appflow.ZendeskConnectorProfile.property.arn"></a>

```typescript
public readonly arn: string;
```

- *Type:* string

---

##### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.ZendeskConnectorProfile.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `credentials`<sup>Optional</sup> <a name="credentials" id="@cdklabs/cdk-appflow.ZendeskConnectorProfile.property.credentials"></a>

```typescript
public readonly credentials: ISecret;
```

- *Type:* aws-cdk-lib.aws_secretsmanager.ISecret

---


## Structs <a name="Structs" id="Structs"></a>

### ConnectorProfileProps <a name="ConnectorProfileProps" id="@cdklabs/cdk-appflow.ConnectorProfileProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.ConnectorProfileProps.Initializer"></a>

```typescript
import { ConnectorProfileProps } from '@cdklabs/cdk-appflow'

const connectorProfileProps: ConnectorProfileProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ConnectorProfileProps.property.key">key</a></code> | <code>aws-cdk-lib.aws_kms.IKey</code> | TODO: think if this should be here as not all connector profiles have that. |
| <code><a href="#@cdklabs/cdk-appflow.ConnectorProfileProps.property.name">name</a></code> | <code>string</code> | *No description.* |

---

##### `key`<sup>Optional</sup> <a name="key" id="@cdklabs/cdk-appflow.ConnectorProfileProps.property.key"></a>

```typescript
public readonly key: IKey;
```

- *Type:* aws-cdk-lib.aws_kms.IKey

TODO: think if this should be here as not all connector profiles have that.

---

##### `name`<sup>Optional</sup> <a name="name" id="@cdklabs/cdk-appflow.ConnectorProfileProps.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

### DataPullConfig <a name="DataPullConfig" id="@cdklabs/cdk-appflow.DataPullConfig"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.DataPullConfig.Initializer"></a>

```typescript
import { DataPullConfig } from '@cdklabs/cdk-appflow'

const dataPullConfig: DataPullConfig = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.DataPullConfig.property.mode">mode</a></code> | <code><a href="#@cdklabs/cdk-appflow.DataPullMode">DataPullMode</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.DataPullConfig.property.timestampField">timestampField</a></code> | <code>string</code> | The name of the field to use as a timestamp for recurring incremental flows. |

---

##### `mode`<sup>Required</sup> <a name="mode" id="@cdklabs/cdk-appflow.DataPullConfig.property.mode"></a>

```typescript
public readonly mode: DataPullMode;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.DataPullMode">DataPullMode</a>

---

##### `timestampField`<sup>Optional</sup> <a name="timestampField" id="@cdklabs/cdk-appflow.DataPullConfig.property.timestampField"></a>

```typescript
public readonly timestampField: string;
```

- *Type:* string

The name of the field to use as a timestamp for recurring incremental flows.

The default field is set per particular @see ISource.

---

### ErrorHandlingConfiguration <a name="ErrorHandlingConfiguration" id="@cdklabs/cdk-appflow.ErrorHandlingConfiguration"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.ErrorHandlingConfiguration.Initializer"></a>

```typescript
import { ErrorHandlingConfiguration } from '@cdklabs/cdk-appflow'

const errorHandlingConfiguration: ErrorHandlingConfiguration = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ErrorHandlingConfiguration.property.errorLocation">errorLocation</a></code> | <code><a href="#@cdklabs/cdk-appflow.S3Location">S3Location</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ErrorHandlingConfiguration.property.failOnFirstError">failOnFirstError</a></code> | <code>boolean</code> | *No description.* |

---

##### `errorLocation`<sup>Optional</sup> <a name="errorLocation" id="@cdklabs/cdk-appflow.ErrorHandlingConfiguration.property.errorLocation"></a>

```typescript
public readonly errorLocation: S3Location;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.S3Location">S3Location</a>

---

##### `failOnFirstError`<sup>Optional</sup> <a name="failOnFirstError" id="@cdklabs/cdk-appflow.ErrorHandlingConfiguration.property.failOnFirstError"></a>

```typescript
public readonly failOnFirstError: boolean;
```

- *Type:* boolean

---

### EventBridgeDestinationProps <a name="EventBridgeDestinationProps" id="@cdklabs/cdk-appflow.EventBridgeDestinationProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.EventBridgeDestinationProps.Initializer"></a>

```typescript
import { EventBridgeDestinationProps } from '@cdklabs/cdk-appflow'

const eventBridgeDestinationProps: EventBridgeDestinationProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.EventBridgeDestinationProps.property.partnerBus">partnerBus</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.EventBridgeDestinationProps.property.errorHandling">errorHandling</a></code> | <code><a href="#@cdklabs/cdk-appflow.ErrorHandlingConfiguration">ErrorHandlingConfiguration</a></code> | *No description.* |

---

##### `partnerBus`<sup>Required</sup> <a name="partnerBus" id="@cdklabs/cdk-appflow.EventBridgeDestinationProps.property.partnerBus"></a>

```typescript
public readonly partnerBus: string;
```

- *Type:* string

---

##### `errorHandling`<sup>Optional</sup> <a name="errorHandling" id="@cdklabs/cdk-appflow.EventBridgeDestinationProps.property.errorHandling"></a>

```typescript
public readonly errorHandling: ErrorHandlingConfiguration;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ErrorHandlingConfiguration">ErrorHandlingConfiguration</a>

---

### Field <a name="Field" id="@cdklabs/cdk-appflow.Field"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.Field.Initializer"></a>

```typescript
import { Field } from '@cdklabs/cdk-appflow'

const field: Field = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.Field.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.Field.property.dataType">dataType</a></code> | <code>string</code> | *No description.* |

---

##### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.Field.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `dataType`<sup>Optional</sup> <a name="dataType" id="@cdklabs/cdk-appflow.Field.property.dataType"></a>

```typescript
public readonly dataType: string;
```

- *Type:* string

---

### FlowBaseProps <a name="FlowBaseProps" id="@cdklabs/cdk-appflow.FlowBaseProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.FlowBaseProps.Initializer"></a>

```typescript
import { FlowBaseProps } from '@cdklabs/cdk-appflow'

const flowBaseProps: FlowBaseProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.FlowBaseProps.property.destination">destination</a></code> | <code><a href="#@cdklabs/cdk-appflow.IDestination">IDestination</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FlowBaseProps.property.mappings">mappings</a></code> | <code><a href="#@cdklabs/cdk-appflow.IMapping">IMapping</a>[]</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FlowBaseProps.property.source">source</a></code> | <code><a href="#@cdklabs/cdk-appflow.ISource">ISource</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FlowBaseProps.property.description">description</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FlowBaseProps.property.filters">filters</a></code> | <code><a href="#@cdklabs/cdk-appflow.IFilter">IFilter</a>[]</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FlowBaseProps.property.key">key</a></code> | <code>aws-cdk-lib.aws_kms.IKey</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FlowBaseProps.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FlowBaseProps.property.transforms">transforms</a></code> | <code><a href="#@cdklabs/cdk-appflow.ITransform">ITransform</a>[]</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FlowBaseProps.property.validations">validations</a></code> | <code><a href="#@cdklabs/cdk-appflow.IValidation">IValidation</a>[]</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FlowBaseProps.property.type">type</a></code> | <code><a href="#@cdklabs/cdk-appflow.FlowType">FlowType</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FlowBaseProps.property.triggerConfig">triggerConfig</a></code> | <code><a href="#@cdklabs/cdk-appflow.TriggerConfig">TriggerConfig</a></code> | *No description.* |

---

##### `destination`<sup>Required</sup> <a name="destination" id="@cdklabs/cdk-appflow.FlowBaseProps.property.destination"></a>

```typescript
public readonly destination: IDestination;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.IDestination">IDestination</a>

---

##### `mappings`<sup>Required</sup> <a name="mappings" id="@cdklabs/cdk-appflow.FlowBaseProps.property.mappings"></a>

```typescript
public readonly mappings: IMapping[];
```

- *Type:* <a href="#@cdklabs/cdk-appflow.IMapping">IMapping</a>[]

---

##### `source`<sup>Required</sup> <a name="source" id="@cdklabs/cdk-appflow.FlowBaseProps.property.source"></a>

```typescript
public readonly source: ISource;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ISource">ISource</a>

---

##### `description`<sup>Optional</sup> <a name="description" id="@cdklabs/cdk-appflow.FlowBaseProps.property.description"></a>

```typescript
public readonly description: string;
```

- *Type:* string

---

##### `filters`<sup>Optional</sup> <a name="filters" id="@cdklabs/cdk-appflow.FlowBaseProps.property.filters"></a>

```typescript
public readonly filters: IFilter[];
```

- *Type:* <a href="#@cdklabs/cdk-appflow.IFilter">IFilter</a>[]

---

##### `key`<sup>Optional</sup> <a name="key" id="@cdklabs/cdk-appflow.FlowBaseProps.property.key"></a>

```typescript
public readonly key: IKey;
```

- *Type:* aws-cdk-lib.aws_kms.IKey

---

##### `name`<sup>Optional</sup> <a name="name" id="@cdklabs/cdk-appflow.FlowBaseProps.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `transforms`<sup>Optional</sup> <a name="transforms" id="@cdklabs/cdk-appflow.FlowBaseProps.property.transforms"></a>

```typescript
public readonly transforms: ITransform[];
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ITransform">ITransform</a>[]

---

##### `validations`<sup>Optional</sup> <a name="validations" id="@cdklabs/cdk-appflow.FlowBaseProps.property.validations"></a>

```typescript
public readonly validations: IValidation[];
```

- *Type:* <a href="#@cdklabs/cdk-appflow.IValidation">IValidation</a>[]

---

##### `type`<sup>Required</sup> <a name="type" id="@cdklabs/cdk-appflow.FlowBaseProps.property.type"></a>

```typescript
public readonly type: FlowType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.FlowType">FlowType</a>

---

##### `triggerConfig`<sup>Optional</sup> <a name="triggerConfig" id="@cdklabs/cdk-appflow.FlowBaseProps.property.triggerConfig"></a>

```typescript
public readonly triggerConfig: TriggerConfig;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.TriggerConfig">TriggerConfig</a>

---

### FlowProps <a name="FlowProps" id="@cdklabs/cdk-appflow.FlowProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.FlowProps.Initializer"></a>

```typescript
import { FlowProps } from '@cdklabs/cdk-appflow'

const flowProps: FlowProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.FlowProps.property.destination">destination</a></code> | <code><a href="#@cdklabs/cdk-appflow.IDestination">IDestination</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FlowProps.property.mappings">mappings</a></code> | <code><a href="#@cdklabs/cdk-appflow.IMapping">IMapping</a>[]</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FlowProps.property.source">source</a></code> | <code><a href="#@cdklabs/cdk-appflow.ISource">ISource</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FlowProps.property.description">description</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FlowProps.property.filters">filters</a></code> | <code><a href="#@cdklabs/cdk-appflow.IFilter">IFilter</a>[]</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FlowProps.property.key">key</a></code> | <code>aws-cdk-lib.aws_kms.IKey</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FlowProps.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FlowProps.property.transforms">transforms</a></code> | <code><a href="#@cdklabs/cdk-appflow.ITransform">ITransform</a>[]</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FlowProps.property.validations">validations</a></code> | <code><a href="#@cdklabs/cdk-appflow.IValidation">IValidation</a>[]</code> | *No description.* |

---

##### `destination`<sup>Required</sup> <a name="destination" id="@cdklabs/cdk-appflow.FlowProps.property.destination"></a>

```typescript
public readonly destination: IDestination;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.IDestination">IDestination</a>

---

##### `mappings`<sup>Required</sup> <a name="mappings" id="@cdklabs/cdk-appflow.FlowProps.property.mappings"></a>

```typescript
public readonly mappings: IMapping[];
```

- *Type:* <a href="#@cdklabs/cdk-appflow.IMapping">IMapping</a>[]

---

##### `source`<sup>Required</sup> <a name="source" id="@cdklabs/cdk-appflow.FlowProps.property.source"></a>

```typescript
public readonly source: ISource;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ISource">ISource</a>

---

##### `description`<sup>Optional</sup> <a name="description" id="@cdklabs/cdk-appflow.FlowProps.property.description"></a>

```typescript
public readonly description: string;
```

- *Type:* string

---

##### `filters`<sup>Optional</sup> <a name="filters" id="@cdklabs/cdk-appflow.FlowProps.property.filters"></a>

```typescript
public readonly filters: IFilter[];
```

- *Type:* <a href="#@cdklabs/cdk-appflow.IFilter">IFilter</a>[]

---

##### `key`<sup>Optional</sup> <a name="key" id="@cdklabs/cdk-appflow.FlowProps.property.key"></a>

```typescript
public readonly key: IKey;
```

- *Type:* aws-cdk-lib.aws_kms.IKey

---

##### `name`<sup>Optional</sup> <a name="name" id="@cdklabs/cdk-appflow.FlowProps.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `transforms`<sup>Optional</sup> <a name="transforms" id="@cdklabs/cdk-appflow.FlowProps.property.transforms"></a>

```typescript
public readonly transforms: ITransform[];
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ITransform">ITransform</a>[]

---

##### `validations`<sup>Optional</sup> <a name="validations" id="@cdklabs/cdk-appflow.FlowProps.property.validations"></a>

```typescript
public readonly validations: IValidation[];
```

- *Type:* <a href="#@cdklabs/cdk-appflow.IValidation">IValidation</a>[]

---

### GoogleAnalytics4ConnectorProfileProps <a name="GoogleAnalytics4ConnectorProfileProps" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfileProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfileProps.Initializer"></a>

```typescript
import { GoogleAnalytics4ConnectorProfileProps } from '@cdklabs/cdk-appflow'

const googleAnalytics4ConnectorProfileProps: GoogleAnalytics4ConnectorProfileProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfileProps.property.key">key</a></code> | <code>aws-cdk-lib.aws_kms.IKey</code> | TODO: think if this should be here as not all connector profiles have that. |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfileProps.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfileProps.property.oAuth">oAuth</a></code> | <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4OAuthSettings">GoogleAnalytics4OAuthSettings</a></code> | *No description.* |

---

##### `key`<sup>Optional</sup> <a name="key" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfileProps.property.key"></a>

```typescript
public readonly key: IKey;
```

- *Type:* aws-cdk-lib.aws_kms.IKey

TODO: think if this should be here as not all connector profiles have that.

---

##### `name`<sup>Optional</sup> <a name="name" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfileProps.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `oAuth`<sup>Required</sup> <a name="oAuth" id="@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfileProps.property.oAuth"></a>

```typescript
public readonly oAuth: GoogleAnalytics4OAuthSettings;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.GoogleAnalytics4OAuthSettings">GoogleAnalytics4OAuthSettings</a>

---

### GoogleAnalytics4OAuthEndpointsSettings <a name="GoogleAnalytics4OAuthEndpointsSettings" id="@cdklabs/cdk-appflow.GoogleAnalytics4OAuthEndpointsSettings"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.GoogleAnalytics4OAuthEndpointsSettings.Initializer"></a>

```typescript
import { GoogleAnalytics4OAuthEndpointsSettings } from '@cdklabs/cdk-appflow'

const googleAnalytics4OAuthEndpointsSettings: GoogleAnalytics4OAuthEndpointsSettings = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4OAuthEndpointsSettings.property.authorization">authorization</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4OAuthEndpointsSettings.property.token">token</a></code> | <code>string</code> | *No description.* |

---

##### `authorization`<sup>Optional</sup> <a name="authorization" id="@cdklabs/cdk-appflow.GoogleAnalytics4OAuthEndpointsSettings.property.authorization"></a>

```typescript
public readonly authorization: string;
```

- *Type:* string

---

##### `token`<sup>Optional</sup> <a name="token" id="@cdklabs/cdk-appflow.GoogleAnalytics4OAuthEndpointsSettings.property.token"></a>

```typescript
public readonly token: string;
```

- *Type:* string

---

### GoogleAnalytics4OAuthFlow <a name="GoogleAnalytics4OAuthFlow" id="@cdklabs/cdk-appflow.GoogleAnalytics4OAuthFlow"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.GoogleAnalytics4OAuthFlow.Initializer"></a>

```typescript
import { GoogleAnalytics4OAuthFlow } from '@cdklabs/cdk-appflow'

const googleAnalytics4OAuthFlow: GoogleAnalytics4OAuthFlow = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4OAuthFlow.property.refreshTokenGrant">refreshTokenGrant</a></code> | <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4RefreshTokenGrantFlow">GoogleAnalytics4RefreshTokenGrantFlow</a></code> | *No description.* |

---

##### `refreshTokenGrant`<sup>Required</sup> <a name="refreshTokenGrant" id="@cdklabs/cdk-appflow.GoogleAnalytics4OAuthFlow.property.refreshTokenGrant"></a>

```typescript
public readonly refreshTokenGrant: GoogleAnalytics4RefreshTokenGrantFlow;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.GoogleAnalytics4RefreshTokenGrantFlow">GoogleAnalytics4RefreshTokenGrantFlow</a>

---

### GoogleAnalytics4OAuthSettings <a name="GoogleAnalytics4OAuthSettings" id="@cdklabs/cdk-appflow.GoogleAnalytics4OAuthSettings"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.GoogleAnalytics4OAuthSettings.Initializer"></a>

```typescript
import { GoogleAnalytics4OAuthSettings } from '@cdklabs/cdk-appflow'

const googleAnalytics4OAuthSettings: GoogleAnalytics4OAuthSettings = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4OAuthSettings.property.accessToken">accessToken</a></code> | <code>string</code> | The access token to be used when interacting with Google Analytics 4. |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4OAuthSettings.property.endpoints">endpoints</a></code> | <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4OAuthEndpointsSettings">GoogleAnalytics4OAuthEndpointsSettings</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4OAuthSettings.property.flow">flow</a></code> | <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4OAuthFlow">GoogleAnalytics4OAuthFlow</a></code> | *No description.* |

---

##### `accessToken`<sup>Optional</sup> <a name="accessToken" id="@cdklabs/cdk-appflow.GoogleAnalytics4OAuthSettings.property.accessToken"></a>

```typescript
public readonly accessToken: string;
```

- *Type:* string

The access token to be used when interacting with Google Analytics 4.

Note that if only the access token is provided AppFlow is not able to retrieve a fresh access token when the current one is expired

---

##### `endpoints`<sup>Optional</sup> <a name="endpoints" id="@cdklabs/cdk-appflow.GoogleAnalytics4OAuthSettings.property.endpoints"></a>

```typescript
public readonly endpoints: GoogleAnalytics4OAuthEndpointsSettings;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.GoogleAnalytics4OAuthEndpointsSettings">GoogleAnalytics4OAuthEndpointsSettings</a>

---

##### `flow`<sup>Optional</sup> <a name="flow" id="@cdklabs/cdk-appflow.GoogleAnalytics4OAuthSettings.property.flow"></a>

```typescript
public readonly flow: GoogleAnalytics4OAuthFlow;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.GoogleAnalytics4OAuthFlow">GoogleAnalytics4OAuthFlow</a>

---

### GoogleAnalytics4RefreshTokenGrantFlow <a name="GoogleAnalytics4RefreshTokenGrantFlow" id="@cdklabs/cdk-appflow.GoogleAnalytics4RefreshTokenGrantFlow"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.GoogleAnalytics4RefreshTokenGrantFlow.Initializer"></a>

```typescript
import { GoogleAnalytics4RefreshTokenGrantFlow } from '@cdklabs/cdk-appflow'

const googleAnalytics4RefreshTokenGrantFlow: GoogleAnalytics4RefreshTokenGrantFlow = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4RefreshTokenGrantFlow.property.clientId">clientId</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4RefreshTokenGrantFlow.property.clientSecret">clientSecret</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4RefreshTokenGrantFlow.property.refreshToken">refreshToken</a></code> | <code>string</code> | *No description.* |

---

##### `clientId`<sup>Optional</sup> <a name="clientId" id="@cdklabs/cdk-appflow.GoogleAnalytics4RefreshTokenGrantFlow.property.clientId"></a>

```typescript
public readonly clientId: string;
```

- *Type:* string

---

##### `clientSecret`<sup>Optional</sup> <a name="clientSecret" id="@cdklabs/cdk-appflow.GoogleAnalytics4RefreshTokenGrantFlow.property.clientSecret"></a>

```typescript
public readonly clientSecret: string;
```

- *Type:* string

---

##### `refreshToken`<sup>Optional</sup> <a name="refreshToken" id="@cdklabs/cdk-appflow.GoogleAnalytics4RefreshTokenGrantFlow.property.refreshToken"></a>

```typescript
public readonly refreshToken: string;
```

- *Type:* string

---

### GoogleAnalytics4SourceProps <a name="GoogleAnalytics4SourceProps" id="@cdklabs/cdk-appflow.GoogleAnalytics4SourceProps"></a>

Properties of a Google Analytics v4 Source.

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.GoogleAnalytics4SourceProps.Initializer"></a>

```typescript
import { GoogleAnalytics4SourceProps } from '@cdklabs/cdk-appflow'

const googleAnalytics4SourceProps: GoogleAnalytics4SourceProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4SourceProps.property.apiVersion">apiVersion</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4SourceProps.property.object">object</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4SourceProps.property.profile">profile</a></code> | <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile">GoogleAnalytics4ConnectorProfile</a></code> | *No description.* |

---

##### `apiVersion`<sup>Required</sup> <a name="apiVersion" id="@cdklabs/cdk-appflow.GoogleAnalytics4SourceProps.property.apiVersion"></a>

```typescript
public readonly apiVersion: string;
```

- *Type:* string

---

##### `object`<sup>Required</sup> <a name="object" id="@cdklabs/cdk-appflow.GoogleAnalytics4SourceProps.property.object"></a>

```typescript
public readonly object: string;
```

- *Type:* string

---

##### `profile`<sup>Required</sup> <a name="profile" id="@cdklabs/cdk-appflow.GoogleAnalytics4SourceProps.property.profile"></a>

```typescript
public readonly profile: GoogleAnalytics4ConnectorProfile;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile">GoogleAnalytics4ConnectorProfile</a>

---

### MapAllConfig <a name="MapAllConfig" id="@cdklabs/cdk-appflow.MapAllConfig"></a>

A helper interface.

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.MapAllConfig.Initializer"></a>

```typescript
import { MapAllConfig } from '@cdklabs/cdk-appflow'

const mapAllConfig: MapAllConfig = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MapAllConfig.property.exclude">exclude</a></code> | <code>string[]</code> | *No description.* |

---

##### `exclude`<sup>Required</sup> <a name="exclude" id="@cdklabs/cdk-appflow.MapAllConfig.property.exclude"></a>

```typescript
public readonly exclude: string[];
```

- *Type:* string[]

---

### MarketoConnectorProfileProps <a name="MarketoConnectorProfileProps" id="@cdklabs/cdk-appflow.MarketoConnectorProfileProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.MarketoConnectorProfileProps.Initializer"></a>

```typescript
import { MarketoConnectorProfileProps } from '@cdklabs/cdk-appflow'

const marketoConnectorProfileProps: MarketoConnectorProfileProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MarketoConnectorProfileProps.property.key">key</a></code> | <code>aws-cdk-lib.aws_kms.IKey</code> | TODO: think if this should be here as not all connector profiles have that. |
| <code><a href="#@cdklabs/cdk-appflow.MarketoConnectorProfileProps.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.MarketoConnectorProfileProps.property.instanceUrl">instanceUrl</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.MarketoConnectorProfileProps.property.oAuth">oAuth</a></code> | <code><a href="#@cdklabs/cdk-appflow.MarketoOAuthSettings">MarketoOAuthSettings</a></code> | *No description.* |

---

##### `key`<sup>Optional</sup> <a name="key" id="@cdklabs/cdk-appflow.MarketoConnectorProfileProps.property.key"></a>

```typescript
public readonly key: IKey;
```

- *Type:* aws-cdk-lib.aws_kms.IKey

TODO: think if this should be here as not all connector profiles have that.

---

##### `name`<sup>Optional</sup> <a name="name" id="@cdklabs/cdk-appflow.MarketoConnectorProfileProps.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `instanceUrl`<sup>Required</sup> <a name="instanceUrl" id="@cdklabs/cdk-appflow.MarketoConnectorProfileProps.property.instanceUrl"></a>

```typescript
public readonly instanceUrl: string;
```

- *Type:* string

---

##### `oAuth`<sup>Required</sup> <a name="oAuth" id="@cdklabs/cdk-appflow.MarketoConnectorProfileProps.property.oAuth"></a>

```typescript
public readonly oAuth: MarketoOAuthSettings;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.MarketoOAuthSettings">MarketoOAuthSettings</a>

---

### MarketoOAuthClientCredentialsFlow <a name="MarketoOAuthClientCredentialsFlow" id="@cdklabs/cdk-appflow.MarketoOAuthClientCredentialsFlow"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.MarketoOAuthClientCredentialsFlow.Initializer"></a>

```typescript
import { MarketoOAuthClientCredentialsFlow } from '@cdklabs/cdk-appflow'

const marketoOAuthClientCredentialsFlow: MarketoOAuthClientCredentialsFlow = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MarketoOAuthClientCredentialsFlow.property.clientId">clientId</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.MarketoOAuthClientCredentialsFlow.property.clientSecret">clientSecret</a></code> | <code>string</code> | *No description.* |

---

##### `clientId`<sup>Required</sup> <a name="clientId" id="@cdklabs/cdk-appflow.MarketoOAuthClientCredentialsFlow.property.clientId"></a>

```typescript
public readonly clientId: string;
```

- *Type:* string

---

##### `clientSecret`<sup>Required</sup> <a name="clientSecret" id="@cdklabs/cdk-appflow.MarketoOAuthClientCredentialsFlow.property.clientSecret"></a>

```typescript
public readonly clientSecret: string;
```

- *Type:* string

---

### MarketoOAuthFlow <a name="MarketoOAuthFlow" id="@cdklabs/cdk-appflow.MarketoOAuthFlow"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.MarketoOAuthFlow.Initializer"></a>

```typescript
import { MarketoOAuthFlow } from '@cdklabs/cdk-appflow'

const marketoOAuthFlow: MarketoOAuthFlow = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MarketoOAuthFlow.property.clientCredentials">clientCredentials</a></code> | <code><a href="#@cdklabs/cdk-appflow.MarketoOAuthClientCredentialsFlow">MarketoOAuthClientCredentialsFlow</a></code> | *No description.* |

---

##### `clientCredentials`<sup>Required</sup> <a name="clientCredentials" id="@cdklabs/cdk-appflow.MarketoOAuthFlow.property.clientCredentials"></a>

```typescript
public readonly clientCredentials: MarketoOAuthClientCredentialsFlow;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.MarketoOAuthClientCredentialsFlow">MarketoOAuthClientCredentialsFlow</a>

---

### MarketoOAuthSettings <a name="MarketoOAuthSettings" id="@cdklabs/cdk-appflow.MarketoOAuthSettings"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.MarketoOAuthSettings.Initializer"></a>

```typescript
import { MarketoOAuthSettings } from '@cdklabs/cdk-appflow'

const marketoOAuthSettings: MarketoOAuthSettings = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MarketoOAuthSettings.property.flow">flow</a></code> | <code><a href="#@cdklabs/cdk-appflow.MarketoOAuthFlow">MarketoOAuthFlow</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.MarketoOAuthSettings.property.accessToken">accessToken</a></code> | <code>string</code> | *No description.* |

---

##### `flow`<sup>Required</sup> <a name="flow" id="@cdklabs/cdk-appflow.MarketoOAuthSettings.property.flow"></a>

```typescript
public readonly flow: MarketoOAuthFlow;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.MarketoOAuthFlow">MarketoOAuthFlow</a>

---

##### `accessToken`<sup>Optional</sup> <a name="accessToken" id="@cdklabs/cdk-appflow.MarketoOAuthSettings.property.accessToken"></a>

```typescript
public readonly accessToken: string;
```

- *Type:* string

---

### MarketoSourceProps <a name="MarketoSourceProps" id="@cdklabs/cdk-appflow.MarketoSourceProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.MarketoSourceProps.Initializer"></a>

```typescript
import { MarketoSourceProps } from '@cdklabs/cdk-appflow'

const marketoSourceProps: MarketoSourceProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MarketoSourceProps.property.object">object</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.MarketoSourceProps.property.profile">profile</a></code> | <code><a href="#@cdklabs/cdk-appflow.MarketoConnectorProfile">MarketoConnectorProfile</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.MarketoSourceProps.property.apiVersion">apiVersion</a></code> | <code>string</code> | *No description.* |

---

##### `object`<sup>Required</sup> <a name="object" id="@cdklabs/cdk-appflow.MarketoSourceProps.property.object"></a>

```typescript
public readonly object: string;
```

- *Type:* string

---

##### `profile`<sup>Required</sup> <a name="profile" id="@cdklabs/cdk-appflow.MarketoSourceProps.property.profile"></a>

```typescript
public readonly profile: MarketoConnectorProfile;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.MarketoConnectorProfile">MarketoConnectorProfile</a>

---

##### `apiVersion`<sup>Optional</sup> <a name="apiVersion" id="@cdklabs/cdk-appflow.MarketoSourceProps.property.apiVersion"></a>

```typescript
public readonly apiVersion: string;
```

- *Type:* string

---

### MicrosoftSharepointOnlineConnectorProfileProps <a name="MicrosoftSharepointOnlineConnectorProfileProps" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfileProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfileProps.Initializer"></a>

```typescript
import { MicrosoftSharepointOnlineConnectorProfileProps } from '@cdklabs/cdk-appflow'

const microsoftSharepointOnlineConnectorProfileProps: MicrosoftSharepointOnlineConnectorProfileProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfileProps.property.key">key</a></code> | <code>aws-cdk-lib.aws_kms.IKey</code> | TODO: think if this should be here as not all connector profiles have that. |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfileProps.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfileProps.property.oAuth">oAuth</a></code> | <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineOAuthSettings">MicrosoftSharepointOnlineOAuthSettings</a></code> | *No description.* |

---

##### `key`<sup>Optional</sup> <a name="key" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfileProps.property.key"></a>

```typescript
public readonly key: IKey;
```

- *Type:* aws-cdk-lib.aws_kms.IKey

TODO: think if this should be here as not all connector profiles have that.

---

##### `name`<sup>Optional</sup> <a name="name" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfileProps.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `oAuth`<sup>Required</sup> <a name="oAuth" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfileProps.property.oAuth"></a>

```typescript
public readonly oAuth: MicrosoftSharepointOnlineOAuthSettings;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineOAuthSettings">MicrosoftSharepointOnlineOAuthSettings</a>

---

### MicrosoftSharepointOnlineOAuthEndpointsSettings <a name="MicrosoftSharepointOnlineOAuthEndpointsSettings" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineOAuthEndpointsSettings"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineOAuthEndpointsSettings.Initializer"></a>

```typescript
import { MicrosoftSharepointOnlineOAuthEndpointsSettings } from '@cdklabs/cdk-appflow'

const microsoftSharepointOnlineOAuthEndpointsSettings: MicrosoftSharepointOnlineOAuthEndpointsSettings = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineOAuthEndpointsSettings.property.token">token</a></code> | <code>string</code> | *No description.* |

---

##### `token`<sup>Required</sup> <a name="token" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineOAuthEndpointsSettings.property.token"></a>

```typescript
public readonly token: string;
```

- *Type:* string

---

### MicrosoftSharepointOnlineOAuthFlow <a name="MicrosoftSharepointOnlineOAuthFlow" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineOAuthFlow"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineOAuthFlow.Initializer"></a>

```typescript
import { MicrosoftSharepointOnlineOAuthFlow } from '@cdklabs/cdk-appflow'

const microsoftSharepointOnlineOAuthFlow: MicrosoftSharepointOnlineOAuthFlow = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineOAuthFlow.property.refreshTokenGrant">refreshTokenGrant</a></code> | <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineRefreshTokenGrantFlow">MicrosoftSharepointOnlineRefreshTokenGrantFlow</a></code> | *No description.* |

---

##### `refreshTokenGrant`<sup>Required</sup> <a name="refreshTokenGrant" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineOAuthFlow.property.refreshTokenGrant"></a>

```typescript
public readonly refreshTokenGrant: MicrosoftSharepointOnlineRefreshTokenGrantFlow;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineRefreshTokenGrantFlow">MicrosoftSharepointOnlineRefreshTokenGrantFlow</a>

---

### MicrosoftSharepointOnlineOAuthSettings <a name="MicrosoftSharepointOnlineOAuthSettings" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineOAuthSettings"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineOAuthSettings.Initializer"></a>

```typescript
import { MicrosoftSharepointOnlineOAuthSettings } from '@cdklabs/cdk-appflow'

const microsoftSharepointOnlineOAuthSettings: MicrosoftSharepointOnlineOAuthSettings = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineOAuthSettings.property.endpoints">endpoints</a></code> | <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineOAuthEndpointsSettings">MicrosoftSharepointOnlineOAuthEndpointsSettings</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineOAuthSettings.property.accessToken">accessToken</a></code> | <code>string</code> | The access token to be used when interacting with Google Analytics 4. |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineOAuthSettings.property.flow">flow</a></code> | <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineOAuthFlow">MicrosoftSharepointOnlineOAuthFlow</a></code> | *No description.* |

---

##### `endpoints`<sup>Required</sup> <a name="endpoints" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineOAuthSettings.property.endpoints"></a>

```typescript
public readonly endpoints: MicrosoftSharepointOnlineOAuthEndpointsSettings;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineOAuthEndpointsSettings">MicrosoftSharepointOnlineOAuthEndpointsSettings</a>

---

##### `accessToken`<sup>Optional</sup> <a name="accessToken" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineOAuthSettings.property.accessToken"></a>

```typescript
public readonly accessToken: string;
```

- *Type:* string

The access token to be used when interacting with Google Analytics 4.

Note that if only the access token is provided AppFlow is not able to retrieve a fresh access token when the current one is expired

---

##### `flow`<sup>Optional</sup> <a name="flow" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineOAuthSettings.property.flow"></a>

```typescript
public readonly flow: MicrosoftSharepointOnlineOAuthFlow;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineOAuthFlow">MicrosoftSharepointOnlineOAuthFlow</a>

---

### MicrosoftSharepointOnlineRefreshTokenGrantFlow <a name="MicrosoftSharepointOnlineRefreshTokenGrantFlow" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineRefreshTokenGrantFlow"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineRefreshTokenGrantFlow.Initializer"></a>

```typescript
import { MicrosoftSharepointOnlineRefreshTokenGrantFlow } from '@cdklabs/cdk-appflow'

const microsoftSharepointOnlineRefreshTokenGrantFlow: MicrosoftSharepointOnlineRefreshTokenGrantFlow = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineRefreshTokenGrantFlow.property.clientId">clientId</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineRefreshTokenGrantFlow.property.clientSecret">clientSecret</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineRefreshTokenGrantFlow.property.refreshToken">refreshToken</a></code> | <code>string</code> | *No description.* |

---

##### `clientId`<sup>Optional</sup> <a name="clientId" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineRefreshTokenGrantFlow.property.clientId"></a>

```typescript
public readonly clientId: string;
```

- *Type:* string

---

##### `clientSecret`<sup>Optional</sup> <a name="clientSecret" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineRefreshTokenGrantFlow.property.clientSecret"></a>

```typescript
public readonly clientSecret: string;
```

- *Type:* string

---

##### `refreshToken`<sup>Optional</sup> <a name="refreshToken" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineRefreshTokenGrantFlow.property.refreshToken"></a>

```typescript
public readonly refreshToken: string;
```

- *Type:* string

---

### MicrosoftSharepointOnlineSourceProps <a name="MicrosoftSharepointOnlineSourceProps" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineSourceProps"></a>

Properties of a Google Analytics v4 Source.

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineSourceProps.Initializer"></a>

```typescript
import { MicrosoftSharepointOnlineSourceProps } from '@cdklabs/cdk-appflow'

const microsoftSharepointOnlineSourceProps: MicrosoftSharepointOnlineSourceProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineSourceProps.property.apiVersion">apiVersion</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineSourceProps.property.object">object</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineSourceProps.property.profile">profile</a></code> | <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile">MicrosoftSharepointOnlineConnectorProfile</a></code> | *No description.* |

---

##### `apiVersion`<sup>Required</sup> <a name="apiVersion" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineSourceProps.property.apiVersion"></a>

```typescript
public readonly apiVersion: string;
```

- *Type:* string

---

##### `object`<sup>Required</sup> <a name="object" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineSourceProps.property.object"></a>

```typescript
public readonly object: string;
```

- *Type:* string

---

##### `profile`<sup>Required</sup> <a name="profile" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineSourceProps.property.profile"></a>

```typescript
public readonly profile: MicrosoftSharepointOnlineConnectorProfile;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile">MicrosoftSharepointOnlineConnectorProfile</a>

---

### OnDemandFlowProps <a name="OnDemandFlowProps" id="@cdklabs/cdk-appflow.OnDemandFlowProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.OnDemandFlowProps.Initializer"></a>

```typescript
import { OnDemandFlowProps } from '@cdklabs/cdk-appflow'

const onDemandFlowProps: OnDemandFlowProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.OnDemandFlowProps.property.destination">destination</a></code> | <code><a href="#@cdklabs/cdk-appflow.IDestination">IDestination</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnDemandFlowProps.property.mappings">mappings</a></code> | <code><a href="#@cdklabs/cdk-appflow.IMapping">IMapping</a>[]</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnDemandFlowProps.property.source">source</a></code> | <code><a href="#@cdklabs/cdk-appflow.ISource">ISource</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnDemandFlowProps.property.description">description</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnDemandFlowProps.property.filters">filters</a></code> | <code><a href="#@cdklabs/cdk-appflow.IFilter">IFilter</a>[]</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnDemandFlowProps.property.key">key</a></code> | <code>aws-cdk-lib.aws_kms.IKey</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnDemandFlowProps.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnDemandFlowProps.property.transforms">transforms</a></code> | <code><a href="#@cdklabs/cdk-appflow.ITransform">ITransform</a>[]</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnDemandFlowProps.property.validations">validations</a></code> | <code><a href="#@cdklabs/cdk-appflow.IValidation">IValidation</a>[]</code> | *No description.* |

---

##### `destination`<sup>Required</sup> <a name="destination" id="@cdklabs/cdk-appflow.OnDemandFlowProps.property.destination"></a>

```typescript
public readonly destination: IDestination;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.IDestination">IDestination</a>

---

##### `mappings`<sup>Required</sup> <a name="mappings" id="@cdklabs/cdk-appflow.OnDemandFlowProps.property.mappings"></a>

```typescript
public readonly mappings: IMapping[];
```

- *Type:* <a href="#@cdklabs/cdk-appflow.IMapping">IMapping</a>[]

---

##### `source`<sup>Required</sup> <a name="source" id="@cdklabs/cdk-appflow.OnDemandFlowProps.property.source"></a>

```typescript
public readonly source: ISource;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ISource">ISource</a>

---

##### `description`<sup>Optional</sup> <a name="description" id="@cdklabs/cdk-appflow.OnDemandFlowProps.property.description"></a>

```typescript
public readonly description: string;
```

- *Type:* string

---

##### `filters`<sup>Optional</sup> <a name="filters" id="@cdklabs/cdk-appflow.OnDemandFlowProps.property.filters"></a>

```typescript
public readonly filters: IFilter[];
```

- *Type:* <a href="#@cdklabs/cdk-appflow.IFilter">IFilter</a>[]

---

##### `key`<sup>Optional</sup> <a name="key" id="@cdklabs/cdk-appflow.OnDemandFlowProps.property.key"></a>

```typescript
public readonly key: IKey;
```

- *Type:* aws-cdk-lib.aws_kms.IKey

---

##### `name`<sup>Optional</sup> <a name="name" id="@cdklabs/cdk-appflow.OnDemandFlowProps.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `transforms`<sup>Optional</sup> <a name="transforms" id="@cdklabs/cdk-appflow.OnDemandFlowProps.property.transforms"></a>

```typescript
public readonly transforms: ITransform[];
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ITransform">ITransform</a>[]

---

##### `validations`<sup>Optional</sup> <a name="validations" id="@cdklabs/cdk-appflow.OnDemandFlowProps.property.validations"></a>

```typescript
public readonly validations: IValidation[];
```

- *Type:* <a href="#@cdklabs/cdk-appflow.IValidation">IValidation</a>[]

---

### OnEventFlowProps <a name="OnEventFlowProps" id="@cdklabs/cdk-appflow.OnEventFlowProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.OnEventFlowProps.Initializer"></a>

```typescript
import { OnEventFlowProps } from '@cdklabs/cdk-appflow'

const onEventFlowProps: OnEventFlowProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlowProps.property.destination">destination</a></code> | <code><a href="#@cdklabs/cdk-appflow.IDestination">IDestination</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlowProps.property.mappings">mappings</a></code> | <code><a href="#@cdklabs/cdk-appflow.IMapping">IMapping</a>[]</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlowProps.property.source">source</a></code> | <code><a href="#@cdklabs/cdk-appflow.ISource">ISource</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlowProps.property.description">description</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlowProps.property.filters">filters</a></code> | <code><a href="#@cdklabs/cdk-appflow.IFilter">IFilter</a>[]</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlowProps.property.key">key</a></code> | <code>aws-cdk-lib.aws_kms.IKey</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlowProps.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlowProps.property.transforms">transforms</a></code> | <code><a href="#@cdklabs/cdk-appflow.ITransform">ITransform</a>[]</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlowProps.property.validations">validations</a></code> | <code><a href="#@cdklabs/cdk-appflow.IValidation">IValidation</a>[]</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnEventFlowProps.property.autoActivate">autoActivate</a></code> | <code>boolean</code> | *No description.* |

---

##### `destination`<sup>Required</sup> <a name="destination" id="@cdklabs/cdk-appflow.OnEventFlowProps.property.destination"></a>

```typescript
public readonly destination: IDestination;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.IDestination">IDestination</a>

---

##### `mappings`<sup>Required</sup> <a name="mappings" id="@cdklabs/cdk-appflow.OnEventFlowProps.property.mappings"></a>

```typescript
public readonly mappings: IMapping[];
```

- *Type:* <a href="#@cdklabs/cdk-appflow.IMapping">IMapping</a>[]

---

##### `source`<sup>Required</sup> <a name="source" id="@cdklabs/cdk-appflow.OnEventFlowProps.property.source"></a>

```typescript
public readonly source: ISource;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ISource">ISource</a>

---

##### `description`<sup>Optional</sup> <a name="description" id="@cdklabs/cdk-appflow.OnEventFlowProps.property.description"></a>

```typescript
public readonly description: string;
```

- *Type:* string

---

##### `filters`<sup>Optional</sup> <a name="filters" id="@cdklabs/cdk-appflow.OnEventFlowProps.property.filters"></a>

```typescript
public readonly filters: IFilter[];
```

- *Type:* <a href="#@cdklabs/cdk-appflow.IFilter">IFilter</a>[]

---

##### `key`<sup>Optional</sup> <a name="key" id="@cdklabs/cdk-appflow.OnEventFlowProps.property.key"></a>

```typescript
public readonly key: IKey;
```

- *Type:* aws-cdk-lib.aws_kms.IKey

---

##### `name`<sup>Optional</sup> <a name="name" id="@cdklabs/cdk-appflow.OnEventFlowProps.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `transforms`<sup>Optional</sup> <a name="transforms" id="@cdklabs/cdk-appflow.OnEventFlowProps.property.transforms"></a>

```typescript
public readonly transforms: ITransform[];
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ITransform">ITransform</a>[]

---

##### `validations`<sup>Optional</sup> <a name="validations" id="@cdklabs/cdk-appflow.OnEventFlowProps.property.validations"></a>

```typescript
public readonly validations: IValidation[];
```

- *Type:* <a href="#@cdklabs/cdk-appflow.IValidation">IValidation</a>[]

---

##### `autoActivate`<sup>Optional</sup> <a name="autoActivate" id="@cdklabs/cdk-appflow.OnEventFlowProps.property.autoActivate"></a>

```typescript
public readonly autoActivate: boolean;
```

- *Type:* boolean

---

### OnScheduleFlowProps <a name="OnScheduleFlowProps" id="@cdklabs/cdk-appflow.OnScheduleFlowProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.OnScheduleFlowProps.Initializer"></a>

```typescript
import { OnScheduleFlowProps } from '@cdklabs/cdk-appflow'

const onScheduleFlowProps: OnScheduleFlowProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlowProps.property.destination">destination</a></code> | <code><a href="#@cdklabs/cdk-appflow.IDestination">IDestination</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlowProps.property.mappings">mappings</a></code> | <code><a href="#@cdklabs/cdk-appflow.IMapping">IMapping</a>[]</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlowProps.property.source">source</a></code> | <code><a href="#@cdklabs/cdk-appflow.ISource">ISource</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlowProps.property.description">description</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlowProps.property.filters">filters</a></code> | <code><a href="#@cdklabs/cdk-appflow.IFilter">IFilter</a>[]</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlowProps.property.key">key</a></code> | <code>aws-cdk-lib.aws_kms.IKey</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlowProps.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlowProps.property.transforms">transforms</a></code> | <code><a href="#@cdklabs/cdk-appflow.ITransform">ITransform</a>[]</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlowProps.property.validations">validations</a></code> | <code><a href="#@cdklabs/cdk-appflow.IValidation">IValidation</a>[]</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlowProps.property.autoActivate">autoActivate</a></code> | <code>boolean</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlowProps.property.pullConfig">pullConfig</a></code> | <code><a href="#@cdklabs/cdk-appflow.DataPullConfig">DataPullConfig</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlowProps.property.schedule">schedule</a></code> | <code>aws-cdk-lib.aws_events.Schedule</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OnScheduleFlowProps.property.scheduleProperties">scheduleProperties</a></code> | <code><a href="#@cdklabs/cdk-appflow.ScheduleProperties">ScheduleProperties</a></code> | *No description.* |

---

##### `destination`<sup>Required</sup> <a name="destination" id="@cdklabs/cdk-appflow.OnScheduleFlowProps.property.destination"></a>

```typescript
public readonly destination: IDestination;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.IDestination">IDestination</a>

---

##### `mappings`<sup>Required</sup> <a name="mappings" id="@cdklabs/cdk-appflow.OnScheduleFlowProps.property.mappings"></a>

```typescript
public readonly mappings: IMapping[];
```

- *Type:* <a href="#@cdklabs/cdk-appflow.IMapping">IMapping</a>[]

---

##### `source`<sup>Required</sup> <a name="source" id="@cdklabs/cdk-appflow.OnScheduleFlowProps.property.source"></a>

```typescript
public readonly source: ISource;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ISource">ISource</a>

---

##### `description`<sup>Optional</sup> <a name="description" id="@cdklabs/cdk-appflow.OnScheduleFlowProps.property.description"></a>

```typescript
public readonly description: string;
```

- *Type:* string

---

##### `filters`<sup>Optional</sup> <a name="filters" id="@cdklabs/cdk-appflow.OnScheduleFlowProps.property.filters"></a>

```typescript
public readonly filters: IFilter[];
```

- *Type:* <a href="#@cdklabs/cdk-appflow.IFilter">IFilter</a>[]

---

##### `key`<sup>Optional</sup> <a name="key" id="@cdklabs/cdk-appflow.OnScheduleFlowProps.property.key"></a>

```typescript
public readonly key: IKey;
```

- *Type:* aws-cdk-lib.aws_kms.IKey

---

##### `name`<sup>Optional</sup> <a name="name" id="@cdklabs/cdk-appflow.OnScheduleFlowProps.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `transforms`<sup>Optional</sup> <a name="transforms" id="@cdklabs/cdk-appflow.OnScheduleFlowProps.property.transforms"></a>

```typescript
public readonly transforms: ITransform[];
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ITransform">ITransform</a>[]

---

##### `validations`<sup>Optional</sup> <a name="validations" id="@cdklabs/cdk-appflow.OnScheduleFlowProps.property.validations"></a>

```typescript
public readonly validations: IValidation[];
```

- *Type:* <a href="#@cdklabs/cdk-appflow.IValidation">IValidation</a>[]

---

##### `autoActivate`<sup>Optional</sup> <a name="autoActivate" id="@cdklabs/cdk-appflow.OnScheduleFlowProps.property.autoActivate"></a>

```typescript
public readonly autoActivate: boolean;
```

- *Type:* boolean

---

##### `pullConfig`<sup>Required</sup> <a name="pullConfig" id="@cdklabs/cdk-appflow.OnScheduleFlowProps.property.pullConfig"></a>

```typescript
public readonly pullConfig: DataPullConfig;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.DataPullConfig">DataPullConfig</a>

---

##### `schedule`<sup>Required</sup> <a name="schedule" id="@cdklabs/cdk-appflow.OnScheduleFlowProps.property.schedule"></a>

```typescript
public readonly schedule: Schedule;
```

- *Type:* aws-cdk-lib.aws_events.Schedule

---

##### `scheduleProperties`<sup>Optional</sup> <a name="scheduleProperties" id="@cdklabs/cdk-appflow.OnScheduleFlowProps.property.scheduleProperties"></a>

```typescript
public readonly scheduleProperties: ScheduleProperties;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ScheduleProperties">ScheduleProperties</a>

---

### RedshiftConnectorBasicCredentials <a name="RedshiftConnectorBasicCredentials" id="@cdklabs/cdk-appflow.RedshiftConnectorBasicCredentials"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.RedshiftConnectorBasicCredentials.Initializer"></a>

```typescript
import { RedshiftConnectorBasicCredentials } from '@cdklabs/cdk-appflow'

const redshiftConnectorBasicCredentials: RedshiftConnectorBasicCredentials = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorBasicCredentials.property.password">password</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorBasicCredentials.property.username">username</a></code> | <code>string</code> | *No description.* |

---

##### `password`<sup>Optional</sup> <a name="password" id="@cdklabs/cdk-appflow.RedshiftConnectorBasicCredentials.property.password"></a>

```typescript
public readonly password: string;
```

- *Type:* string

---

##### `username`<sup>Optional</sup> <a name="username" id="@cdklabs/cdk-appflow.RedshiftConnectorBasicCredentials.property.username"></a>

```typescript
public readonly username: string;
```

- *Type:* string

---

### RedshiftConnectorProfileProps <a name="RedshiftConnectorProfileProps" id="@cdklabs/cdk-appflow.RedshiftConnectorProfileProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.RedshiftConnectorProfileProps.Initializer"></a>

```typescript
import { RedshiftConnectorProfileProps } from '@cdklabs/cdk-appflow'

const redshiftConnectorProfileProps: RedshiftConnectorProfileProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfileProps.property.key">key</a></code> | <code>aws-cdk-lib.aws_kms.IKey</code> | TODO: think if this should be here as not all connector profiles have that. |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfileProps.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfileProps.property.basicAuth">basicAuth</a></code> | <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorBasicCredentials">RedshiftConnectorBasicCredentials</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfileProps.property.cluster">cluster</a></code> | <code>@aws-cdk/aws-redshift-alpha.ICluster</code> | The Redshift cluster to use this connector profile with. |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfileProps.property.databaseName">databaseName</a></code> | <code>string</code> | The name of the database which the RedshiftConnectorProfile will be working with. |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfileProps.property.intermediateLocation">intermediateLocation</a></code> | <code><a href="#@cdklabs/cdk-appflow.S3Location">S3Location</a></code> | An intermediate location for the data retrieved from the flow source that will be further transferred to the Redshfit database. |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfileProps.property.bucketAccessRole">bucketAccessRole</a></code> | <code>aws-cdk-lib.aws_iam.IRole</code> | An IAM Role that the Redshift cluster will assume to get data from the intermiediate S3 Bucket. |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfileProps.property.dataApiRole">dataApiRole</a></code> | <code>aws-cdk-lib.aws_iam.IRole</code> | An IAM Role that AppFlow will assume to interact with the Redshift cluster's Data API. |

---

##### `key`<sup>Optional</sup> <a name="key" id="@cdklabs/cdk-appflow.RedshiftConnectorProfileProps.property.key"></a>

```typescript
public readonly key: IKey;
```

- *Type:* aws-cdk-lib.aws_kms.IKey

TODO: think if this should be here as not all connector profiles have that.

---

##### `name`<sup>Optional</sup> <a name="name" id="@cdklabs/cdk-appflow.RedshiftConnectorProfileProps.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `basicAuth`<sup>Required</sup> <a name="basicAuth" id="@cdklabs/cdk-appflow.RedshiftConnectorProfileProps.property.basicAuth"></a>

```typescript
public readonly basicAuth: RedshiftConnectorBasicCredentials;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.RedshiftConnectorBasicCredentials">RedshiftConnectorBasicCredentials</a>

---

##### `cluster`<sup>Required</sup> <a name="cluster" id="@cdklabs/cdk-appflow.RedshiftConnectorProfileProps.property.cluster"></a>

```typescript
public readonly cluster: ICluster;
```

- *Type:* @aws-cdk/aws-redshift-alpha.ICluster

The Redshift cluster to use this connector profile with.

---

##### `databaseName`<sup>Required</sup> <a name="databaseName" id="@cdklabs/cdk-appflow.RedshiftConnectorProfileProps.property.databaseName"></a>

```typescript
public readonly databaseName: string;
```

- *Type:* string

The name of the database which the RedshiftConnectorProfile will be working with.

---

##### `intermediateLocation`<sup>Required</sup> <a name="intermediateLocation" id="@cdklabs/cdk-appflow.RedshiftConnectorProfileProps.property.intermediateLocation"></a>

```typescript
public readonly intermediateLocation: S3Location;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.S3Location">S3Location</a>

An intermediate location for the data retrieved from the flow source that will be further transferred to the Redshfit database.

---

##### `bucketAccessRole`<sup>Optional</sup> <a name="bucketAccessRole" id="@cdklabs/cdk-appflow.RedshiftConnectorProfileProps.property.bucketAccessRole"></a>

```typescript
public readonly bucketAccessRole: IRole;
```

- *Type:* aws-cdk-lib.aws_iam.IRole

An IAM Role that the Redshift cluster will assume to get data from the intermiediate S3 Bucket.

---

##### `dataApiRole`<sup>Optional</sup> <a name="dataApiRole" id="@cdklabs/cdk-appflow.RedshiftConnectorProfileProps.property.dataApiRole"></a>

```typescript
public readonly dataApiRole: IRole;
```

- *Type:* aws-cdk-lib.aws_iam.IRole
- *Default:* autogenerated IAM role

An IAM Role that AppFlow will assume to interact with the Redshift cluster's Data API.

---

### RedshiftDestinationObject <a name="RedshiftDestinationObject" id="@cdklabs/cdk-appflow.RedshiftDestinationObject"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.RedshiftDestinationObject.Initializer"></a>

```typescript
import { RedshiftDestinationObject } from '@cdklabs/cdk-appflow'

const redshiftDestinationObject: RedshiftDestinationObject = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftDestinationObject.property.table">table</a></code> | <code>string \| @aws-cdk/aws-redshift-alpha.ITable</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftDestinationObject.property.schema">schema</a></code> | <code>string</code> | *No description.* |

---

##### `table`<sup>Required</sup> <a name="table" id="@cdklabs/cdk-appflow.RedshiftDestinationObject.property.table"></a>

```typescript
public readonly table: string | ITable;
```

- *Type:* string | @aws-cdk/aws-redshift-alpha.ITable

---

##### `schema`<sup>Optional</sup> <a name="schema" id="@cdklabs/cdk-appflow.RedshiftDestinationObject.property.schema"></a>

```typescript
public readonly schema: string;
```

- *Type:* string
- *Default:* public

---

### RedshiftDestinationProps <a name="RedshiftDestinationProps" id="@cdklabs/cdk-appflow.RedshiftDestinationProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.RedshiftDestinationProps.Initializer"></a>

```typescript
import { RedshiftDestinationProps } from '@cdklabs/cdk-appflow'

const redshiftDestinationProps: RedshiftDestinationProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftDestinationProps.property.object">object</a></code> | <code><a href="#@cdklabs/cdk-appflow.RedshiftDestinationObject">RedshiftDestinationObject</a></code> | A Redshift table object (optionally with the schema). |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftDestinationProps.property.profile">profile</a></code> | <code><a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfile">RedshiftConnectorProfile</a></code> | An instance of the @type RedshiftConnectorProfile. |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftDestinationProps.property.errorHandling">errorHandling</a></code> | <code><a href="#@cdklabs/cdk-appflow.ErrorHandlingConfiguration">ErrorHandlingConfiguration</a></code> | The settings that determine how Amazon AppFlow handles an error when placing data in the Salesforce destination. |

---

##### `object`<sup>Required</sup> <a name="object" id="@cdklabs/cdk-appflow.RedshiftDestinationProps.property.object"></a>

```typescript
public readonly object: RedshiftDestinationObject;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.RedshiftDestinationObject">RedshiftDestinationObject</a>

A Redshift table object (optionally with the schema).

---

##### `profile`<sup>Required</sup> <a name="profile" id="@cdklabs/cdk-appflow.RedshiftDestinationProps.property.profile"></a>

```typescript
public readonly profile: RedshiftConnectorProfile;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfile">RedshiftConnectorProfile</a>

An instance of the @type RedshiftConnectorProfile.

---

##### `errorHandling`<sup>Optional</sup> <a name="errorHandling" id="@cdklabs/cdk-appflow.RedshiftDestinationProps.property.errorHandling"></a>

```typescript
public readonly errorHandling: ErrorHandlingConfiguration;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ErrorHandlingConfiguration">ErrorHandlingConfiguration</a>

The settings that determine how Amazon AppFlow handles an error when placing data in the Salesforce destination.

For example, this setting would determine if the flow should fail after one insertion error, or continue and attempt to insert every record regardless of the initial failure.

---

### S3Catalog <a name="S3Catalog" id="@cdklabs/cdk-appflow.S3Catalog"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.S3Catalog.Initializer"></a>

```typescript
import { S3Catalog } from '@cdklabs/cdk-appflow'

const s3Catalog: S3Catalog = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.S3Catalog.property.database">database</a></code> | <code>@aws-cdk/aws-glue-alpha.Database</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.S3Catalog.property.tablePrefix">tablePrefix</a></code> | <code>string</code> | *No description.* |

---

##### `database`<sup>Required</sup> <a name="database" id="@cdklabs/cdk-appflow.S3Catalog.property.database"></a>

```typescript
public readonly database: Database;
```

- *Type:* @aws-cdk/aws-glue-alpha.Database

---

##### `tablePrefix`<sup>Required</sup> <a name="tablePrefix" id="@cdklabs/cdk-appflow.S3Catalog.property.tablePrefix"></a>

```typescript
public readonly tablePrefix: string;
```

- *Type:* string

---

### S3DestinationProps <a name="S3DestinationProps" id="@cdklabs/cdk-appflow.S3DestinationProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.S3DestinationProps.Initializer"></a>

```typescript
import { S3DestinationProps } from '@cdklabs/cdk-appflow'

const s3DestinationProps: S3DestinationProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.S3DestinationProps.property.location">location</a></code> | <code><a href="#@cdklabs/cdk-appflow.S3Location">S3Location</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.S3DestinationProps.property.catalog">catalog</a></code> | <code><a href="#@cdklabs/cdk-appflow.S3Catalog">S3Catalog</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.S3DestinationProps.property.formatting">formatting</a></code> | <code><a href="#@cdklabs/cdk-appflow.S3OutputFormatting">S3OutputFormatting</a></code> | *No description.* |

---

##### `location`<sup>Required</sup> <a name="location" id="@cdklabs/cdk-appflow.S3DestinationProps.property.location"></a>

```typescript
public readonly location: S3Location;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.S3Location">S3Location</a>

---

##### `catalog`<sup>Optional</sup> <a name="catalog" id="@cdklabs/cdk-appflow.S3DestinationProps.property.catalog"></a>

```typescript
public readonly catalog: S3Catalog;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.S3Catalog">S3Catalog</a>

---

##### `formatting`<sup>Optional</sup> <a name="formatting" id="@cdklabs/cdk-appflow.S3DestinationProps.property.formatting"></a>

```typescript
public readonly formatting: S3OutputFormatting;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.S3OutputFormatting">S3OutputFormatting</a>

---

### S3FileAggregation <a name="S3FileAggregation" id="@cdklabs/cdk-appflow.S3FileAggregation"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.S3FileAggregation.Initializer"></a>

```typescript
import { S3FileAggregation } from '@cdklabs/cdk-appflow'

const s3FileAggregation: S3FileAggregation = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.S3FileAggregation.property.fileSize">fileSize</a></code> | <code>number</code> | The maximum size, in MB, of the file containing portion of incoming data. |
| <code><a href="#@cdklabs/cdk-appflow.S3FileAggregation.property.type">type</a></code> | <code><a href="#@cdklabs/cdk-appflow.S3OutputAggregationType">S3OutputAggregationType</a></code> | *No description.* |

---

##### `fileSize`<sup>Optional</sup> <a name="fileSize" id="@cdklabs/cdk-appflow.S3FileAggregation.property.fileSize"></a>

```typescript
public readonly fileSize: number;
```

- *Type:* number

The maximum size, in MB, of the file containing portion of incoming data.

---

##### `type`<sup>Optional</sup> <a name="type" id="@cdklabs/cdk-appflow.S3FileAggregation.property.type"></a>

```typescript
public readonly type: S3OutputAggregationType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.S3OutputAggregationType">S3OutputAggregationType</a>

---

### S3InputFormat <a name="S3InputFormat" id="@cdklabs/cdk-appflow.S3InputFormat"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.S3InputFormat.Initializer"></a>

```typescript
import { S3InputFormat } from '@cdklabs/cdk-appflow'

const s3InputFormat: S3InputFormat = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.S3InputFormat.property.type">type</a></code> | <code><a href="#@cdklabs/cdk-appflow.S3InputFileType">S3InputFileType</a></code> | *No description.* |

---

##### `type`<sup>Required</sup> <a name="type" id="@cdklabs/cdk-appflow.S3InputFormat.property.type"></a>

```typescript
public readonly type: S3InputFileType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.S3InputFileType">S3InputFileType</a>

---

### S3Location <a name="S3Location" id="@cdklabs/cdk-appflow.S3Location"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.S3Location.Initializer"></a>

```typescript
import { S3Location } from '@cdklabs/cdk-appflow'

const s3Location: S3Location = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.S3Location.property.bucket">bucket</a></code> | <code>aws-cdk-lib.aws_s3.IBucket</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.S3Location.property.prefix">prefix</a></code> | <code>string</code> | *No description.* |

---

##### `bucket`<sup>Required</sup> <a name="bucket" id="@cdklabs/cdk-appflow.S3Location.property.bucket"></a>

```typescript
public readonly bucket: IBucket;
```

- *Type:* aws-cdk-lib.aws_s3.IBucket

---

##### `prefix`<sup>Optional</sup> <a name="prefix" id="@cdklabs/cdk-appflow.S3Location.property.prefix"></a>

```typescript
public readonly prefix: string;
```

- *Type:* string

---

### S3OutputFilePrefix <a name="S3OutputFilePrefix" id="@cdklabs/cdk-appflow.S3OutputFilePrefix"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.S3OutputFilePrefix.Initializer"></a>

```typescript
import { S3OutputFilePrefix } from '@cdklabs/cdk-appflow'

const s3OutputFilePrefix: S3OutputFilePrefix = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.S3OutputFilePrefix.property.format">format</a></code> | <code><a href="#@cdklabs/cdk-appflow.S3OutputFilePrefixFormat">S3OutputFilePrefixFormat</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.S3OutputFilePrefix.property.hierarchy">hierarchy</a></code> | <code><a href="#@cdklabs/cdk-appflow.S3OutputFilePrefixHierarchy">S3OutputFilePrefixHierarchy</a>[]</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.S3OutputFilePrefix.property.type">type</a></code> | <code><a href="#@cdklabs/cdk-appflow.S3OutputFilePrefixType">S3OutputFilePrefixType</a></code> | *No description.* |

---

##### `format`<sup>Optional</sup> <a name="format" id="@cdklabs/cdk-appflow.S3OutputFilePrefix.property.format"></a>

```typescript
public readonly format: S3OutputFilePrefixFormat;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.S3OutputFilePrefixFormat">S3OutputFilePrefixFormat</a>

---

##### `hierarchy`<sup>Optional</sup> <a name="hierarchy" id="@cdklabs/cdk-appflow.S3OutputFilePrefix.property.hierarchy"></a>

```typescript
public readonly hierarchy: S3OutputFilePrefixHierarchy[];
```

- *Type:* <a href="#@cdklabs/cdk-appflow.S3OutputFilePrefixHierarchy">S3OutputFilePrefixHierarchy</a>[]

---

##### `type`<sup>Optional</sup> <a name="type" id="@cdklabs/cdk-appflow.S3OutputFilePrefix.property.type"></a>

```typescript
public readonly type: S3OutputFilePrefixType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.S3OutputFilePrefixType">S3OutputFilePrefixType</a>

---

### S3OutputFormatting <a name="S3OutputFormatting" id="@cdklabs/cdk-appflow.S3OutputFormatting"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.S3OutputFormatting.Initializer"></a>

```typescript
import { S3OutputFormatting } from '@cdklabs/cdk-appflow'

const s3OutputFormatting: S3OutputFormatting = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.S3OutputFormatting.property.aggregation">aggregation</a></code> | <code><a href="#@cdklabs/cdk-appflow.S3FileAggregation">S3FileAggregation</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.S3OutputFormatting.property.filePrefix">filePrefix</a></code> | <code><a href="#@cdklabs/cdk-appflow.S3OutputFilePrefix">S3OutputFilePrefix</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.S3OutputFormatting.property.fileType">fileType</a></code> | <code><a href="#@cdklabs/cdk-appflow.S3OutputFileType">S3OutputFileType</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.S3OutputFormatting.property.preserveSourceDataTypes">preserveSourceDataTypes</a></code> | <code>boolean</code> | *No description.* |

---

##### `aggregation`<sup>Optional</sup> <a name="aggregation" id="@cdklabs/cdk-appflow.S3OutputFormatting.property.aggregation"></a>

```typescript
public readonly aggregation: S3FileAggregation;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.S3FileAggregation">S3FileAggregation</a>

---

##### `filePrefix`<sup>Optional</sup> <a name="filePrefix" id="@cdklabs/cdk-appflow.S3OutputFormatting.property.filePrefix"></a>

```typescript
public readonly filePrefix: S3OutputFilePrefix;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.S3OutputFilePrefix">S3OutputFilePrefix</a>

---

##### `fileType`<sup>Optional</sup> <a name="fileType" id="@cdklabs/cdk-appflow.S3OutputFormatting.property.fileType"></a>

```typescript
public readonly fileType: S3OutputFileType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.S3OutputFileType">S3OutputFileType</a>

---

##### `preserveSourceDataTypes`<sup>Optional</sup> <a name="preserveSourceDataTypes" id="@cdklabs/cdk-appflow.S3OutputFormatting.property.preserveSourceDataTypes"></a>

```typescript
public readonly preserveSourceDataTypes: boolean;
```

- *Type:* boolean

---

### S3SourceProps <a name="S3SourceProps" id="@cdklabs/cdk-appflow.S3SourceProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.S3SourceProps.Initializer"></a>

```typescript
import { S3SourceProps } from '@cdklabs/cdk-appflow'

const s3SourceProps: S3SourceProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.S3SourceProps.property.bucket">bucket</a></code> | <code>aws-cdk-lib.aws_s3.IBucket</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.S3SourceProps.property.prefix">prefix</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.S3SourceProps.property.format">format</a></code> | <code><a href="#@cdklabs/cdk-appflow.S3InputFormat">S3InputFormat</a></code> | *No description.* |

---

##### `bucket`<sup>Required</sup> <a name="bucket" id="@cdklabs/cdk-appflow.S3SourceProps.property.bucket"></a>

```typescript
public readonly bucket: IBucket;
```

- *Type:* aws-cdk-lib.aws_s3.IBucket

---

##### `prefix`<sup>Required</sup> <a name="prefix" id="@cdklabs/cdk-appflow.S3SourceProps.property.prefix"></a>

```typescript
public readonly prefix: string;
```

- *Type:* string

---

##### `format`<sup>Optional</sup> <a name="format" id="@cdklabs/cdk-appflow.S3SourceProps.property.format"></a>

```typescript
public readonly format: S3InputFormat;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.S3InputFormat">S3InputFormat</a>

---

### SalesforceConnectorProfileProps <a name="SalesforceConnectorProfileProps" id="@cdklabs/cdk-appflow.SalesforceConnectorProfileProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.SalesforceConnectorProfileProps.Initializer"></a>

```typescript
import { SalesforceConnectorProfileProps } from '@cdklabs/cdk-appflow'

const salesforceConnectorProfileProps: SalesforceConnectorProfileProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceConnectorProfileProps.property.key">key</a></code> | <code>aws-cdk-lib.aws_kms.IKey</code> | TODO: think if this should be here as not all connector profiles have that. |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceConnectorProfileProps.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceConnectorProfileProps.property.instanceUrl">instanceUrl</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceConnectorProfileProps.property.oAuth">oAuth</a></code> | <code><a href="#@cdklabs/cdk-appflow.SalesforceOAuthSettings">SalesforceOAuthSettings</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceConnectorProfileProps.property.isSandbox">isSandbox</a></code> | <code>boolean</code> | *No description.* |

---

##### `key`<sup>Optional</sup> <a name="key" id="@cdklabs/cdk-appflow.SalesforceConnectorProfileProps.property.key"></a>

```typescript
public readonly key: IKey;
```

- *Type:* aws-cdk-lib.aws_kms.IKey

TODO: think if this should be here as not all connector profiles have that.

---

##### `name`<sup>Optional</sup> <a name="name" id="@cdklabs/cdk-appflow.SalesforceConnectorProfileProps.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `instanceUrl`<sup>Required</sup> <a name="instanceUrl" id="@cdklabs/cdk-appflow.SalesforceConnectorProfileProps.property.instanceUrl"></a>

```typescript
public readonly instanceUrl: string;
```

- *Type:* string

---

##### `oAuth`<sup>Required</sup> <a name="oAuth" id="@cdklabs/cdk-appflow.SalesforceConnectorProfileProps.property.oAuth"></a>

```typescript
public readonly oAuth: SalesforceOAuthSettings;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.SalesforceOAuthSettings">SalesforceOAuthSettings</a>

---

##### `isSandbox`<sup>Optional</sup> <a name="isSandbox" id="@cdklabs/cdk-appflow.SalesforceConnectorProfileProps.property.isSandbox"></a>

```typescript
public readonly isSandbox: boolean;
```

- *Type:* boolean
- *Default:* false

---

### SalesforceDestinationProps <a name="SalesforceDestinationProps" id="@cdklabs/cdk-appflow.SalesforceDestinationProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.SalesforceDestinationProps.Initializer"></a>

```typescript
import { SalesforceDestinationProps } from '@cdklabs/cdk-appflow'

const salesforceDestinationProps: SalesforceDestinationProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceDestinationProps.property.object">object</a></code> | <code>string</code> | The Salesforce object for which the operation is to be set. |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceDestinationProps.property.operation">operation</a></code> | <code><a href="#@cdklabs/cdk-appflow.WriteOperation">WriteOperation</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceDestinationProps.property.profile">profile</a></code> | <code><a href="#@cdklabs/cdk-appflow.SalesforceConnectorProfile">SalesforceConnectorProfile</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceDestinationProps.property.dataTransferApi">dataTransferApi</a></code> | <code><a href="#@cdklabs/cdk-appflow.SalesforceDataTransferApi">SalesforceDataTransferApi</a></code> | Specifies which Salesforce API is used by Amazon AppFlow when your flow transfers data to Salesforce. |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceDestinationProps.property.errorHandling">errorHandling</a></code> | <code><a href="#@cdklabs/cdk-appflow.ErrorHandlingConfiguration">ErrorHandlingConfiguration</a></code> | The settings that determine how Amazon AppFlow handles an error when placing data in the Salesforce destination. |

---

##### `object`<sup>Required</sup> <a name="object" id="@cdklabs/cdk-appflow.SalesforceDestinationProps.property.object"></a>

```typescript
public readonly object: string;
```

- *Type:* string

The Salesforce object for which the operation is to be set.

---

##### `operation`<sup>Required</sup> <a name="operation" id="@cdklabs/cdk-appflow.SalesforceDestinationProps.property.operation"></a>

```typescript
public readonly operation: WriteOperation;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.WriteOperation">WriteOperation</a>

---

##### `profile`<sup>Required</sup> <a name="profile" id="@cdklabs/cdk-appflow.SalesforceDestinationProps.property.profile"></a>

```typescript
public readonly profile: SalesforceConnectorProfile;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.SalesforceConnectorProfile">SalesforceConnectorProfile</a>

---

##### `dataTransferApi`<sup>Optional</sup> <a name="dataTransferApi" id="@cdklabs/cdk-appflow.SalesforceDestinationProps.property.dataTransferApi"></a>

```typescript
public readonly dataTransferApi: SalesforceDataTransferApi;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.SalesforceDataTransferApi">SalesforceDataTransferApi</a>

Specifies which Salesforce API is used by Amazon AppFlow when your flow transfers data to Salesforce.

---

##### `errorHandling`<sup>Optional</sup> <a name="errorHandling" id="@cdklabs/cdk-appflow.SalesforceDestinationProps.property.errorHandling"></a>

```typescript
public readonly errorHandling: ErrorHandlingConfiguration;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ErrorHandlingConfiguration">ErrorHandlingConfiguration</a>

The settings that determine how Amazon AppFlow handles an error when placing data in the Salesforce destination.

For example, this setting would determine if the flow should fail after one insertion error, or continue and attempt to insert every record regardless of the initial failure.

---

### SalesforceMarketingCloudConnectorProfileProps <a name="SalesforceMarketingCloudConnectorProfileProps" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfileProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfileProps.Initializer"></a>

```typescript
import { SalesforceMarketingCloudConnectorProfileProps } from '@cdklabs/cdk-appflow'

const salesforceMarketingCloudConnectorProfileProps: SalesforceMarketingCloudConnectorProfileProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfileProps.property.key">key</a></code> | <code>aws-cdk-lib.aws_kms.IKey</code> | TODO: think if this should be here as not all connector profiles have that. |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfileProps.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfileProps.property.instanceUrl">instanceUrl</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfileProps.property.oAuth">oAuth</a></code> | <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudOAuthSettings">SalesforceMarketingCloudOAuthSettings</a></code> | *No description.* |

---

##### `key`<sup>Optional</sup> <a name="key" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfileProps.property.key"></a>

```typescript
public readonly key: IKey;
```

- *Type:* aws-cdk-lib.aws_kms.IKey

TODO: think if this should be here as not all connector profiles have that.

---

##### `name`<sup>Optional</sup> <a name="name" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfileProps.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `instanceUrl`<sup>Required</sup> <a name="instanceUrl" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfileProps.property.instanceUrl"></a>

```typescript
public readonly instanceUrl: string;
```

- *Type:* string

---

##### `oAuth`<sup>Required</sup> <a name="oAuth" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfileProps.property.oAuth"></a>

```typescript
public readonly oAuth: SalesforceMarketingCloudOAuthSettings;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudOAuthSettings">SalesforceMarketingCloudOAuthSettings</a>

---

### SalesforceMarketingCloudFlowSettings <a name="SalesforceMarketingCloudFlowSettings" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudFlowSettings"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudFlowSettings.Initializer"></a>

```typescript
import { SalesforceMarketingCloudFlowSettings } from '@cdklabs/cdk-appflow'

const salesforceMarketingCloudFlowSettings: SalesforceMarketingCloudFlowSettings = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudFlowSettings.property.clientCredentials">clientCredentials</a></code> | <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudOAuthClientSettings">SalesforceMarketingCloudOAuthClientSettings</a></code> | *No description.* |

---

##### `clientCredentials`<sup>Required</sup> <a name="clientCredentials" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudFlowSettings.property.clientCredentials"></a>

```typescript
public readonly clientCredentials: SalesforceMarketingCloudOAuthClientSettings;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudOAuthClientSettings">SalesforceMarketingCloudOAuthClientSettings</a>

---

### SalesforceMarketingCloudOAuthClientSettings <a name="SalesforceMarketingCloudOAuthClientSettings" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudOAuthClientSettings"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudOAuthClientSettings.Initializer"></a>

```typescript
import { SalesforceMarketingCloudOAuthClientSettings } from '@cdklabs/cdk-appflow'

const salesforceMarketingCloudOAuthClientSettings: SalesforceMarketingCloudOAuthClientSettings = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudOAuthClientSettings.property.clientId">clientId</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudOAuthClientSettings.property.clientSecret">clientSecret</a></code> | <code>string</code> | *No description.* |

---

##### `clientId`<sup>Required</sup> <a name="clientId" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudOAuthClientSettings.property.clientId"></a>

```typescript
public readonly clientId: string;
```

- *Type:* string

---

##### `clientSecret`<sup>Required</sup> <a name="clientSecret" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudOAuthClientSettings.property.clientSecret"></a>

```typescript
public readonly clientSecret: string;
```

- *Type:* string

---

### SalesforceMarketingCloudOAuthEndpoints <a name="SalesforceMarketingCloudOAuthEndpoints" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudOAuthEndpoints"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudOAuthEndpoints.Initializer"></a>

```typescript
import { SalesforceMarketingCloudOAuthEndpoints } from '@cdklabs/cdk-appflow'

const salesforceMarketingCloudOAuthEndpoints: SalesforceMarketingCloudOAuthEndpoints = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudOAuthEndpoints.property.token">token</a></code> | <code>string</code> | *No description.* |

---

##### `token`<sup>Required</sup> <a name="token" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudOAuthEndpoints.property.token"></a>

```typescript
public readonly token: string;
```

- *Type:* string

---

### SalesforceMarketingCloudOAuthSettings <a name="SalesforceMarketingCloudOAuthSettings" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudOAuthSettings"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudOAuthSettings.Initializer"></a>

```typescript
import { SalesforceMarketingCloudOAuthSettings } from '@cdklabs/cdk-appflow'

const salesforceMarketingCloudOAuthSettings: SalesforceMarketingCloudOAuthSettings = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudOAuthSettings.property.endpoints">endpoints</a></code> | <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudOAuthEndpoints">SalesforceMarketingCloudOAuthEndpoints</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudOAuthSettings.property.accessToken">accessToken</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudOAuthSettings.property.flow">flow</a></code> | <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudFlowSettings">SalesforceMarketingCloudFlowSettings</a></code> | *No description.* |

---

##### `endpoints`<sup>Required</sup> <a name="endpoints" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudOAuthSettings.property.endpoints"></a>

```typescript
public readonly endpoints: SalesforceMarketingCloudOAuthEndpoints;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudOAuthEndpoints">SalesforceMarketingCloudOAuthEndpoints</a>

---

##### `accessToken`<sup>Optional</sup> <a name="accessToken" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudOAuthSettings.property.accessToken"></a>

```typescript
public readonly accessToken: string;
```

- *Type:* string

---

##### `flow`<sup>Optional</sup> <a name="flow" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudOAuthSettings.property.flow"></a>

```typescript
public readonly flow: SalesforceMarketingCloudFlowSettings;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudFlowSettings">SalesforceMarketingCloudFlowSettings</a>

---

### SalesforceMarketingCloudSourceProps <a name="SalesforceMarketingCloudSourceProps" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudSourceProps"></a>

Properties of a Salesforce Marketing Cloud Source.

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudSourceProps.Initializer"></a>

```typescript
import { SalesforceMarketingCloudSourceProps } from '@cdklabs/cdk-appflow'

const salesforceMarketingCloudSourceProps: SalesforceMarketingCloudSourceProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudSourceProps.property.apiVersion">apiVersion</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudSourceProps.property.object">object</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudSourceProps.property.profile">profile</a></code> | <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile">SalesforceMarketingCloudConnectorProfile</a></code> | *No description.* |

---

##### `apiVersion`<sup>Required</sup> <a name="apiVersion" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudSourceProps.property.apiVersion"></a>

```typescript
public readonly apiVersion: string;
```

- *Type:* string

---

##### `object`<sup>Required</sup> <a name="object" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudSourceProps.property.object"></a>

```typescript
public readonly object: string;
```

- *Type:* string

---

##### `profile`<sup>Required</sup> <a name="profile" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudSourceProps.property.profile"></a>

```typescript
public readonly profile: SalesforceMarketingCloudConnectorProfile;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile">SalesforceMarketingCloudConnectorProfile</a>

---

### SalesforceOAuthFlow <a name="SalesforceOAuthFlow" id="@cdklabs/cdk-appflow.SalesforceOAuthFlow"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.SalesforceOAuthFlow.Initializer"></a>

```typescript
import { SalesforceOAuthFlow } from '@cdklabs/cdk-appflow'

const salesforceOAuthFlow: SalesforceOAuthFlow = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceOAuthFlow.property.refresTokenGrant">refresTokenGrant</a></code> | <code><a href="#@cdklabs/cdk-appflow.SalesforceOAuthRefreshTokenGrantFlow">SalesforceOAuthRefreshTokenGrantFlow</a></code> | *No description.* |

---

##### `refresTokenGrant`<sup>Required</sup> <a name="refresTokenGrant" id="@cdklabs/cdk-appflow.SalesforceOAuthFlow.property.refresTokenGrant"></a>

```typescript
public readonly refresTokenGrant: SalesforceOAuthRefreshTokenGrantFlow;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.SalesforceOAuthRefreshTokenGrantFlow">SalesforceOAuthRefreshTokenGrantFlow</a>

---

### SalesforceOAuthRefreshTokenGrantFlow <a name="SalesforceOAuthRefreshTokenGrantFlow" id="@cdklabs/cdk-appflow.SalesforceOAuthRefreshTokenGrantFlow"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.SalesforceOAuthRefreshTokenGrantFlow.Initializer"></a>

```typescript
import { SalesforceOAuthRefreshTokenGrantFlow } from '@cdklabs/cdk-appflow'

const salesforceOAuthRefreshTokenGrantFlow: SalesforceOAuthRefreshTokenGrantFlow = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceOAuthRefreshTokenGrantFlow.property.client">client</a></code> | <code>aws-cdk-lib.aws_secretsmanager.ISecret</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceOAuthRefreshTokenGrantFlow.property.refreshToken">refreshToken</a></code> | <code>string</code> | *No description.* |

---

##### `client`<sup>Optional</sup> <a name="client" id="@cdklabs/cdk-appflow.SalesforceOAuthRefreshTokenGrantFlow.property.client"></a>

```typescript
public readonly client: ISecret;
```

- *Type:* aws-cdk-lib.aws_secretsmanager.ISecret

---

##### `refreshToken`<sup>Optional</sup> <a name="refreshToken" id="@cdklabs/cdk-appflow.SalesforceOAuthRefreshTokenGrantFlow.property.refreshToken"></a>

```typescript
public readonly refreshToken: string;
```

- *Type:* string

---

### SalesforceOAuthSettings <a name="SalesforceOAuthSettings" id="@cdklabs/cdk-appflow.SalesforceOAuthSettings"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.SalesforceOAuthSettings.Initializer"></a>

```typescript
import { SalesforceOAuthSettings } from '@cdklabs/cdk-appflow'

const salesforceOAuthSettings: SalesforceOAuthSettings = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceOAuthSettings.property.accessToken">accessToken</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceOAuthSettings.property.flow">flow</a></code> | <code><a href="#@cdklabs/cdk-appflow.SalesforceOAuthFlow">SalesforceOAuthFlow</a></code> | *No description.* |

---

##### `accessToken`<sup>Optional</sup> <a name="accessToken" id="@cdklabs/cdk-appflow.SalesforceOAuthSettings.property.accessToken"></a>

```typescript
public readonly accessToken: string;
```

- *Type:* string

---

##### `flow`<sup>Optional</sup> <a name="flow" id="@cdklabs/cdk-appflow.SalesforceOAuthSettings.property.flow"></a>

```typescript
public readonly flow: SalesforceOAuthFlow;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.SalesforceOAuthFlow">SalesforceOAuthFlow</a>

---

### SalesforceSourceProps <a name="SalesforceSourceProps" id="@cdklabs/cdk-appflow.SalesforceSourceProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.SalesforceSourceProps.Initializer"></a>

```typescript
import { SalesforceSourceProps } from '@cdklabs/cdk-appflow'

const salesforceSourceProps: SalesforceSourceProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceSourceProps.property.object">object</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceSourceProps.property.profile">profile</a></code> | <code><a href="#@cdklabs/cdk-appflow.SalesforceConnectorProfile">SalesforceConnectorProfile</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceSourceProps.property.apiVersion">apiVersion</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceSourceProps.property.enableDynamicFieldUpdate">enableDynamicFieldUpdate</a></code> | <code>boolean</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceSourceProps.property.includeDeletedRecords">includeDeletedRecords</a></code> | <code>boolean</code> | *No description.* |

---

##### `object`<sup>Required</sup> <a name="object" id="@cdklabs/cdk-appflow.SalesforceSourceProps.property.object"></a>

```typescript
public readonly object: string;
```

- *Type:* string

---

##### `profile`<sup>Required</sup> <a name="profile" id="@cdklabs/cdk-appflow.SalesforceSourceProps.property.profile"></a>

```typescript
public readonly profile: SalesforceConnectorProfile;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.SalesforceConnectorProfile">SalesforceConnectorProfile</a>

---

##### `apiVersion`<sup>Optional</sup> <a name="apiVersion" id="@cdklabs/cdk-appflow.SalesforceSourceProps.property.apiVersion"></a>

```typescript
public readonly apiVersion: string;
```

- *Type:* string

---

##### `enableDynamicFieldUpdate`<sup>Optional</sup> <a name="enableDynamicFieldUpdate" id="@cdklabs/cdk-appflow.SalesforceSourceProps.property.enableDynamicFieldUpdate"></a>

```typescript
public readonly enableDynamicFieldUpdate: boolean;
```

- *Type:* boolean

---

##### `includeDeletedRecords`<sup>Optional</sup> <a name="includeDeletedRecords" id="@cdklabs/cdk-appflow.SalesforceSourceProps.property.includeDeletedRecords"></a>

```typescript
public readonly includeDeletedRecords: boolean;
```

- *Type:* boolean

---

### SAPOdataBasicAuthSettings <a name="SAPOdataBasicAuthSettings" id="@cdklabs/cdk-appflow.SAPOdataBasicAuthSettings"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.SAPOdataBasicAuthSettings.Initializer"></a>

```typescript
import { SAPOdataBasicAuthSettings } from '@cdklabs/cdk-appflow'

const sAPOdataBasicAuthSettings: SAPOdataBasicAuthSettings = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataBasicAuthSettings.property.password">password</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataBasicAuthSettings.property.username">username</a></code> | <code>string</code> | *No description.* |

---

##### `password`<sup>Required</sup> <a name="password" id="@cdklabs/cdk-appflow.SAPOdataBasicAuthSettings.property.password"></a>

```typescript
public readonly password: string;
```

- *Type:* string

---

##### `username`<sup>Required</sup> <a name="username" id="@cdklabs/cdk-appflow.SAPOdataBasicAuthSettings.property.username"></a>

```typescript
public readonly username: string;
```

- *Type:* string

---

### SAPOdataConnectorProfileProps <a name="SAPOdataConnectorProfileProps" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfileProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfileProps.Initializer"></a>

```typescript
import { SAPOdataConnectorProfileProps } from '@cdklabs/cdk-appflow'

const sAPOdataConnectorProfileProps: SAPOdataConnectorProfileProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfileProps.property.key">key</a></code> | <code>aws-cdk-lib.aws_kms.IKey</code> | TODO: think if this should be here as not all connector profiles have that. |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfileProps.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfileProps.property.applicationHostUrl">applicationHostUrl</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfileProps.property.applicationServicePath">applicationServicePath</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfileProps.property.clientNumber">clientNumber</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfileProps.property.logonLanguage">logonLanguage</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfileProps.property.basicAuth">basicAuth</a></code> | <code><a href="#@cdklabs/cdk-appflow.SAPOdataBasicAuthSettings">SAPOdataBasicAuthSettings</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfileProps.property.oAuth">oAuth</a></code> | <code><a href="#@cdklabs/cdk-appflow.SAPOdataOAuthSettings">SAPOdataOAuthSettings</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfileProps.property.portNumber">portNumber</a></code> | <code>number</code> | *No description.* |

---

##### `key`<sup>Optional</sup> <a name="key" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfileProps.property.key"></a>

```typescript
public readonly key: IKey;
```

- *Type:* aws-cdk-lib.aws_kms.IKey

TODO: think if this should be here as not all connector profiles have that.

---

##### `name`<sup>Optional</sup> <a name="name" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfileProps.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `applicationHostUrl`<sup>Required</sup> <a name="applicationHostUrl" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfileProps.property.applicationHostUrl"></a>

```typescript
public readonly applicationHostUrl: string;
```

- *Type:* string

---

##### `applicationServicePath`<sup>Required</sup> <a name="applicationServicePath" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfileProps.property.applicationServicePath"></a>

```typescript
public readonly applicationServicePath: string;
```

- *Type:* string

---

##### `clientNumber`<sup>Required</sup> <a name="clientNumber" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfileProps.property.clientNumber"></a>

```typescript
public readonly clientNumber: string;
```

- *Type:* string

---

##### `logonLanguage`<sup>Required</sup> <a name="logonLanguage" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfileProps.property.logonLanguage"></a>

```typescript
public readonly logonLanguage: string;
```

- *Type:* string

---

##### `basicAuth`<sup>Optional</sup> <a name="basicAuth" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfileProps.property.basicAuth"></a>

```typescript
public readonly basicAuth: SAPOdataBasicAuthSettings;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.SAPOdataBasicAuthSettings">SAPOdataBasicAuthSettings</a>

---

##### `oAuth`<sup>Optional</sup> <a name="oAuth" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfileProps.property.oAuth"></a>

```typescript
public readonly oAuth: SAPOdataOAuthSettings;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.SAPOdataOAuthSettings">SAPOdataOAuthSettings</a>

---

##### `portNumber`<sup>Optional</sup> <a name="portNumber" id="@cdklabs/cdk-appflow.SAPOdataConnectorProfileProps.property.portNumber"></a>

```typescript
public readonly portNumber: number;
```

- *Type:* number

---

### SAPOdataDestinationProps <a name="SAPOdataDestinationProps" id="@cdklabs/cdk-appflow.SAPOdataDestinationProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.SAPOdataDestinationProps.Initializer"></a>

```typescript
import { SAPOdataDestinationProps } from '@cdklabs/cdk-appflow'

const sAPOdataDestinationProps: SAPOdataDestinationProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataDestinationProps.property.object">object</a></code> | <code>string</code> | The SAPOdata object for which the operation is to be set. |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataDestinationProps.property.operation">operation</a></code> | <code><a href="#@cdklabs/cdk-appflow.WriteOperation">WriteOperation</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataDestinationProps.property.profile">profile</a></code> | <code><a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfile">SAPOdataConnectorProfile</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataDestinationProps.property.errorHandling">errorHandling</a></code> | <code><a href="#@cdklabs/cdk-appflow.ErrorHandlingConfiguration">ErrorHandlingConfiguration</a></code> | The settings that determine how Amazon AppFlow handles an error when placing data in the SAPOdata destination. |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataDestinationProps.property.successResponseHandling">successResponseHandling</a></code> | <code><a href="#@cdklabs/cdk-appflow.SAPOdataSuccessResponseHandlingConfiguration">SAPOdataSuccessResponseHandlingConfiguration</a></code> | *No description.* |

---

##### `object`<sup>Required</sup> <a name="object" id="@cdklabs/cdk-appflow.SAPOdataDestinationProps.property.object"></a>

```typescript
public readonly object: string;
```

- *Type:* string

The SAPOdata object for which the operation is to be set.

---

##### `operation`<sup>Required</sup> <a name="operation" id="@cdklabs/cdk-appflow.SAPOdataDestinationProps.property.operation"></a>

```typescript
public readonly operation: WriteOperation;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.WriteOperation">WriteOperation</a>

---

##### `profile`<sup>Required</sup> <a name="profile" id="@cdklabs/cdk-appflow.SAPOdataDestinationProps.property.profile"></a>

```typescript
public readonly profile: SAPOdataConnectorProfile;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfile">SAPOdataConnectorProfile</a>

---

##### `errorHandling`<sup>Optional</sup> <a name="errorHandling" id="@cdklabs/cdk-appflow.SAPOdataDestinationProps.property.errorHandling"></a>

```typescript
public readonly errorHandling: ErrorHandlingConfiguration;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ErrorHandlingConfiguration">ErrorHandlingConfiguration</a>

The settings that determine how Amazon AppFlow handles an error when placing data in the SAPOdata destination.

For example, this setting would determine if the flow should fail after one insertion error, or continue and attempt to insert every record regardless of the initial failure.

---

##### `successResponseHandling`<sup>Optional</sup> <a name="successResponseHandling" id="@cdklabs/cdk-appflow.SAPOdataDestinationProps.property.successResponseHandling"></a>

```typescript
public readonly successResponseHandling: SAPOdataSuccessResponseHandlingConfiguration;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.SAPOdataSuccessResponseHandlingConfiguration">SAPOdataSuccessResponseHandlingConfiguration</a>

---

### SAPOdataOAuthEndpoints <a name="SAPOdataOAuthEndpoints" id="@cdklabs/cdk-appflow.SAPOdataOAuthEndpoints"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.SAPOdataOAuthEndpoints.Initializer"></a>

```typescript
import { SAPOdataOAuthEndpoints } from '@cdklabs/cdk-appflow'

const sAPOdataOAuthEndpoints: SAPOdataOAuthEndpoints = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataOAuthEndpoints.property.token">token</a></code> | <code>string</code> | *No description.* |

---

##### `token`<sup>Required</sup> <a name="token" id="@cdklabs/cdk-appflow.SAPOdataOAuthEndpoints.property.token"></a>

```typescript
public readonly token: string;
```

- *Type:* string

---

### SAPOdataOAuthFlows <a name="SAPOdataOAuthFlows" id="@cdklabs/cdk-appflow.SAPOdataOAuthFlows"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.SAPOdataOAuthFlows.Initializer"></a>

```typescript
import { SAPOdataOAuthFlows } from '@cdklabs/cdk-appflow'

const sAPOdataOAuthFlows: SAPOdataOAuthFlows = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataOAuthFlows.property.refreshTokenGrant">refreshTokenGrant</a></code> | <code><a href="#@cdklabs/cdk-appflow.SAPOdataOAuthRefreshTokenGrantFlow">SAPOdataOAuthRefreshTokenGrantFlow</a></code> | *No description.* |

---

##### `refreshTokenGrant`<sup>Required</sup> <a name="refreshTokenGrant" id="@cdklabs/cdk-appflow.SAPOdataOAuthFlows.property.refreshTokenGrant"></a>

```typescript
public readonly refreshTokenGrant: SAPOdataOAuthRefreshTokenGrantFlow;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.SAPOdataOAuthRefreshTokenGrantFlow">SAPOdataOAuthRefreshTokenGrantFlow</a>

---

### SAPOdataOAuthRefreshTokenGrantFlow <a name="SAPOdataOAuthRefreshTokenGrantFlow" id="@cdklabs/cdk-appflow.SAPOdataOAuthRefreshTokenGrantFlow"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.SAPOdataOAuthRefreshTokenGrantFlow.Initializer"></a>

```typescript
import { SAPOdataOAuthRefreshTokenGrantFlow } from '@cdklabs/cdk-appflow'

const sAPOdataOAuthRefreshTokenGrantFlow: SAPOdataOAuthRefreshTokenGrantFlow = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataOAuthRefreshTokenGrantFlow.property.clientId">clientId</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataOAuthRefreshTokenGrantFlow.property.clientSecret">clientSecret</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataOAuthRefreshTokenGrantFlow.property.refreshToken">refreshToken</a></code> | <code>string</code> | *No description.* |

---

##### `clientId`<sup>Required</sup> <a name="clientId" id="@cdklabs/cdk-appflow.SAPOdataOAuthRefreshTokenGrantFlow.property.clientId"></a>

```typescript
public readonly clientId: string;
```

- *Type:* string

---

##### `clientSecret`<sup>Required</sup> <a name="clientSecret" id="@cdklabs/cdk-appflow.SAPOdataOAuthRefreshTokenGrantFlow.property.clientSecret"></a>

```typescript
public readonly clientSecret: string;
```

- *Type:* string

---

##### `refreshToken`<sup>Optional</sup> <a name="refreshToken" id="@cdklabs/cdk-appflow.SAPOdataOAuthRefreshTokenGrantFlow.property.refreshToken"></a>

```typescript
public readonly refreshToken: string;
```

- *Type:* string

---

### SAPOdataOAuthSettings <a name="SAPOdataOAuthSettings" id="@cdklabs/cdk-appflow.SAPOdataOAuthSettings"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.SAPOdataOAuthSettings.Initializer"></a>

```typescript
import { SAPOdataOAuthSettings } from '@cdklabs/cdk-appflow'

const sAPOdataOAuthSettings: SAPOdataOAuthSettings = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataOAuthSettings.property.accessToken">accessToken</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataOAuthSettings.property.endpoints">endpoints</a></code> | <code><a href="#@cdklabs/cdk-appflow.SAPOdataOAuthEndpoints">SAPOdataOAuthEndpoints</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataOAuthSettings.property.flow">flow</a></code> | <code><a href="#@cdklabs/cdk-appflow.SAPOdataOAuthFlows">SAPOdataOAuthFlows</a></code> | *No description.* |

---

##### `accessToken`<sup>Optional</sup> <a name="accessToken" id="@cdklabs/cdk-appflow.SAPOdataOAuthSettings.property.accessToken"></a>

```typescript
public readonly accessToken: string;
```

- *Type:* string

---

##### `endpoints`<sup>Optional</sup> <a name="endpoints" id="@cdklabs/cdk-appflow.SAPOdataOAuthSettings.property.endpoints"></a>

```typescript
public readonly endpoints: SAPOdataOAuthEndpoints;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.SAPOdataOAuthEndpoints">SAPOdataOAuthEndpoints</a>

---

##### `flow`<sup>Optional</sup> <a name="flow" id="@cdklabs/cdk-appflow.SAPOdataOAuthSettings.property.flow"></a>

```typescript
public readonly flow: SAPOdataOAuthFlows;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.SAPOdataOAuthFlows">SAPOdataOAuthFlows</a>

---

### SAPOdataSourceProps <a name="SAPOdataSourceProps" id="@cdklabs/cdk-appflow.SAPOdataSourceProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.SAPOdataSourceProps.Initializer"></a>

```typescript
import { SAPOdataSourceProps } from '@cdklabs/cdk-appflow'

const sAPOdataSourceProps: SAPOdataSourceProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataSourceProps.property.object">object</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataSourceProps.property.profile">profile</a></code> | <code><a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfile">SAPOdataConnectorProfile</a></code> | *No description.* |

---

##### `object`<sup>Required</sup> <a name="object" id="@cdklabs/cdk-appflow.SAPOdataSourceProps.property.object"></a>

```typescript
public readonly object: string;
```

- *Type:* string

---

##### `profile`<sup>Required</sup> <a name="profile" id="@cdklabs/cdk-appflow.SAPOdataSourceProps.property.profile"></a>

```typescript
public readonly profile: SAPOdataConnectorProfile;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfile">SAPOdataConnectorProfile</a>

---

### SAPOdataSuccessResponseHandlingConfiguration <a name="SAPOdataSuccessResponseHandlingConfiguration" id="@cdklabs/cdk-appflow.SAPOdataSuccessResponseHandlingConfiguration"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.SAPOdataSuccessResponseHandlingConfiguration.Initializer"></a>

```typescript
import { SAPOdataSuccessResponseHandlingConfiguration } from '@cdklabs/cdk-appflow'

const sAPOdataSuccessResponseHandlingConfiguration: SAPOdataSuccessResponseHandlingConfiguration = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataSuccessResponseHandlingConfiguration.property.location">location</a></code> | <code><a href="#@cdklabs/cdk-appflow.S3Location">S3Location</a></code> | *No description.* |

---

##### `location`<sup>Required</sup> <a name="location" id="@cdklabs/cdk-appflow.SAPOdataSuccessResponseHandlingConfiguration.property.location"></a>

```typescript
public readonly location: S3Location;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.S3Location">S3Location</a>

---

### ScheduleProperties <a name="ScheduleProperties" id="@cdklabs/cdk-appflow.ScheduleProperties"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.ScheduleProperties.Initializer"></a>

```typescript
import { ScheduleProperties } from '@cdklabs/cdk-appflow'

const scheduleProperties: ScheduleProperties = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ScheduleProperties.property.endTime">endTime</a></code> | <code>Date</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ScheduleProperties.property.firstExecutionFrom">firstExecutionFrom</a></code> | <code>Date</code> | Timestamp for the records to import from the connector in the first flow run. |
| <code><a href="#@cdklabs/cdk-appflow.ScheduleProperties.property.offset">offset</a></code> | <code>aws-cdk-lib.Duration</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ScheduleProperties.property.startTime">startTime</a></code> | <code>Date</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ScheduleProperties.property.timezone">timezone</a></code> | <code>string</code> | *No description.* |

---

##### `endTime`<sup>Optional</sup> <a name="endTime" id="@cdklabs/cdk-appflow.ScheduleProperties.property.endTime"></a>

```typescript
public readonly endTime: Date;
```

- *Type:* Date

---

##### `firstExecutionFrom`<sup>Optional</sup> <a name="firstExecutionFrom" id="@cdklabs/cdk-appflow.ScheduleProperties.property.firstExecutionFrom"></a>

```typescript
public readonly firstExecutionFrom: Date;
```

- *Type:* Date
- *Default:* 30 days back from the initial frow run

Timestamp for the records to import from the connector in the first flow run.

---

##### `offset`<sup>Optional</sup> <a name="offset" id="@cdklabs/cdk-appflow.ScheduleProperties.property.offset"></a>

```typescript
public readonly offset: Duration;
```

- *Type:* aws-cdk-lib.Duration

---

##### `startTime`<sup>Optional</sup> <a name="startTime" id="@cdklabs/cdk-appflow.ScheduleProperties.property.startTime"></a>

```typescript
public readonly startTime: Date;
```

- *Type:* Date

---

##### `timezone`<sup>Optional</sup> <a name="timezone" id="@cdklabs/cdk-appflow.ScheduleProperties.property.timezone"></a>

```typescript
public readonly timezone: string;
```

- *Type:* string

---

### ServiceNowBasicSettings <a name="ServiceNowBasicSettings" id="@cdklabs/cdk-appflow.ServiceNowBasicSettings"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.ServiceNowBasicSettings.Initializer"></a>

```typescript
import { ServiceNowBasicSettings } from '@cdklabs/cdk-appflow'

const serviceNowBasicSettings: ServiceNowBasicSettings = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ServiceNowBasicSettings.property.password">password</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ServiceNowBasicSettings.property.username">username</a></code> | <code>string</code> | *No description.* |

---

##### `password`<sup>Required</sup> <a name="password" id="@cdklabs/cdk-appflow.ServiceNowBasicSettings.property.password"></a>

```typescript
public readonly password: string;
```

- *Type:* string

---

##### `username`<sup>Required</sup> <a name="username" id="@cdklabs/cdk-appflow.ServiceNowBasicSettings.property.username"></a>

```typescript
public readonly username: string;
```

- *Type:* string

---

### ServiceNowConnectorProfileProps <a name="ServiceNowConnectorProfileProps" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfileProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfileProps.Initializer"></a>

```typescript
import { ServiceNowConnectorProfileProps } from '@cdklabs/cdk-appflow'

const serviceNowConnectorProfileProps: ServiceNowConnectorProfileProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ServiceNowConnectorProfileProps.property.key">key</a></code> | <code>aws-cdk-lib.aws_kms.IKey</code> | TODO: think if this should be here as not all connector profiles have that. |
| <code><a href="#@cdklabs/cdk-appflow.ServiceNowConnectorProfileProps.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ServiceNowConnectorProfileProps.property.basicAuth">basicAuth</a></code> | <code><a href="#@cdklabs/cdk-appflow.ServiceNowBasicSettings">ServiceNowBasicSettings</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ServiceNowConnectorProfileProps.property.instanceUrl">instanceUrl</a></code> | <code>string</code> | *No description.* |

---

##### `key`<sup>Optional</sup> <a name="key" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfileProps.property.key"></a>

```typescript
public readonly key: IKey;
```

- *Type:* aws-cdk-lib.aws_kms.IKey

TODO: think if this should be here as not all connector profiles have that.

---

##### `name`<sup>Optional</sup> <a name="name" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfileProps.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `basicAuth`<sup>Required</sup> <a name="basicAuth" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfileProps.property.basicAuth"></a>

```typescript
public readonly basicAuth: ServiceNowBasicSettings;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ServiceNowBasicSettings">ServiceNowBasicSettings</a>

---

##### `instanceUrl`<sup>Required</sup> <a name="instanceUrl" id="@cdklabs/cdk-appflow.ServiceNowConnectorProfileProps.property.instanceUrl"></a>

```typescript
public readonly instanceUrl: string;
```

- *Type:* string

---

### ServiceNowSourceProps <a name="ServiceNowSourceProps" id="@cdklabs/cdk-appflow.ServiceNowSourceProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.ServiceNowSourceProps.Initializer"></a>

```typescript
import { ServiceNowSourceProps } from '@cdklabs/cdk-appflow'

const serviceNowSourceProps: ServiceNowSourceProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ServiceNowSourceProps.property.object">object</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ServiceNowSourceProps.property.profile">profile</a></code> | <code><a href="#@cdklabs/cdk-appflow.ServiceNowConnectorProfile">ServiceNowConnectorProfile</a></code> | *No description.* |

---

##### `object`<sup>Required</sup> <a name="object" id="@cdklabs/cdk-appflow.ServiceNowSourceProps.property.object"></a>

```typescript
public readonly object: string;
```

- *Type:* string

---

##### `profile`<sup>Required</sup> <a name="profile" id="@cdklabs/cdk-appflow.ServiceNowSourceProps.property.profile"></a>

```typescript
public readonly profile: ServiceNowConnectorProfile;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ServiceNowConnectorProfile">ServiceNowConnectorProfile</a>

---

### SlackConnectorProfileProps <a name="SlackConnectorProfileProps" id="@cdklabs/cdk-appflow.SlackConnectorProfileProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.SlackConnectorProfileProps.Initializer"></a>

```typescript
import { SlackConnectorProfileProps } from '@cdklabs/cdk-appflow'

const slackConnectorProfileProps: SlackConnectorProfileProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SlackConnectorProfileProps.property.key">key</a></code> | <code>aws-cdk-lib.aws_kms.IKey</code> | TODO: think if this should be here as not all connector profiles have that. |
| <code><a href="#@cdklabs/cdk-appflow.SlackConnectorProfileProps.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SlackConnectorProfileProps.property.instanceUrl">instanceUrl</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SlackConnectorProfileProps.property.oAuth">oAuth</a></code> | <code><a href="#@cdklabs/cdk-appflow.SlackOAuthSettings">SlackOAuthSettings</a></code> | *No description.* |

---

##### `key`<sup>Optional</sup> <a name="key" id="@cdklabs/cdk-appflow.SlackConnectorProfileProps.property.key"></a>

```typescript
public readonly key: IKey;
```

- *Type:* aws-cdk-lib.aws_kms.IKey

TODO: think if this should be here as not all connector profiles have that.

---

##### `name`<sup>Optional</sup> <a name="name" id="@cdklabs/cdk-appflow.SlackConnectorProfileProps.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `instanceUrl`<sup>Required</sup> <a name="instanceUrl" id="@cdklabs/cdk-appflow.SlackConnectorProfileProps.property.instanceUrl"></a>

```typescript
public readonly instanceUrl: string;
```

- *Type:* string

---

##### `oAuth`<sup>Required</sup> <a name="oAuth" id="@cdklabs/cdk-appflow.SlackConnectorProfileProps.property.oAuth"></a>

```typescript
public readonly oAuth: SlackOAuthSettings;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.SlackOAuthSettings">SlackOAuthSettings</a>

---

### SlackOAuthSettings <a name="SlackOAuthSettings" id="@cdklabs/cdk-appflow.SlackOAuthSettings"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.SlackOAuthSettings.Initializer"></a>

```typescript
import { SlackOAuthSettings } from '@cdklabs/cdk-appflow'

const slackOAuthSettings: SlackOAuthSettings = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SlackOAuthSettings.property.accessToken">accessToken</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SlackOAuthSettings.property.clientId">clientId</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SlackOAuthSettings.property.clientSecret">clientSecret</a></code> | <code>string</code> | *No description.* |

---

##### `accessToken`<sup>Required</sup> <a name="accessToken" id="@cdklabs/cdk-appflow.SlackOAuthSettings.property.accessToken"></a>

```typescript
public readonly accessToken: string;
```

- *Type:* string

---

##### `clientId`<sup>Optional</sup> <a name="clientId" id="@cdklabs/cdk-appflow.SlackOAuthSettings.property.clientId"></a>

```typescript
public readonly clientId: string;
```

- *Type:* string

---

##### `clientSecret`<sup>Optional</sup> <a name="clientSecret" id="@cdklabs/cdk-appflow.SlackOAuthSettings.property.clientSecret"></a>

```typescript
public readonly clientSecret: string;
```

- *Type:* string

---

### SlackSourceProps <a name="SlackSourceProps" id="@cdklabs/cdk-appflow.SlackSourceProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.SlackSourceProps.Initializer"></a>

```typescript
import { SlackSourceProps } from '@cdklabs/cdk-appflow'

const slackSourceProps: SlackSourceProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SlackSourceProps.property.object">object</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SlackSourceProps.property.profile">profile</a></code> | <code><a href="#@cdklabs/cdk-appflow.SlackConnectorProfile">SlackConnectorProfile</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SlackSourceProps.property.apiVersion">apiVersion</a></code> | <code>string</code> | *No description.* |

---

##### `object`<sup>Required</sup> <a name="object" id="@cdklabs/cdk-appflow.SlackSourceProps.property.object"></a>

```typescript
public readonly object: string;
```

- *Type:* string

---

##### `profile`<sup>Required</sup> <a name="profile" id="@cdklabs/cdk-appflow.SlackSourceProps.property.profile"></a>

```typescript
public readonly profile: SlackConnectorProfile;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.SlackConnectorProfile">SlackConnectorProfile</a>

---

##### `apiVersion`<sup>Optional</sup> <a name="apiVersion" id="@cdklabs/cdk-appflow.SlackSourceProps.property.apiVersion"></a>

```typescript
public readonly apiVersion: string;
```

- *Type:* string

---

### TaskConnectorOperator <a name="TaskConnectorOperator" id="@cdklabs/cdk-appflow.TaskConnectorOperator"></a>

A pair that represents the (typically source) connector, and a task operation to be performed in the context of the connector.

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.TaskConnectorOperator.Initializer"></a>

```typescript
import { TaskConnectorOperator } from '@cdklabs/cdk-appflow'

const taskConnectorOperator: TaskConnectorOperator = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.TaskConnectorOperator.property.operation">operation</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.TaskConnectorOperator.property.type">type</a></code> | <code><a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a></code> | *No description.* |

---

##### `operation`<sup>Required</sup> <a name="operation" id="@cdklabs/cdk-appflow.TaskConnectorOperator.property.operation"></a>

```typescript
public readonly operation: string;
```

- *Type:* string

---

##### `type`<sup>Optional</sup> <a name="type" id="@cdklabs/cdk-appflow.TaskConnectorOperator.property.type"></a>

```typescript
public readonly type: ConnectorType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a>

---

### TaskProperties <a name="TaskProperties" id="@cdklabs/cdk-appflow.TaskProperties"></a>

A generic bucket for the task properties.

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.TaskProperties.Initializer"></a>

```typescript
import { TaskProperties } from '@cdklabs/cdk-appflow'

const taskProperties: TaskProperties = { ... }
```


### TriggerConfig <a name="TriggerConfig" id="@cdklabs/cdk-appflow.TriggerConfig"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.TriggerConfig.Initializer"></a>

```typescript
import { TriggerConfig } from '@cdklabs/cdk-appflow'

const triggerConfig: TriggerConfig = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.TriggerConfig.property.properties">properties</a></code> | <code><a href="#@cdklabs/cdk-appflow.TriggerProperties">TriggerProperties</a></code> | *No description.* |

---

##### `properties`<sup>Optional</sup> <a name="properties" id="@cdklabs/cdk-appflow.TriggerConfig.property.properties"></a>

```typescript
public readonly properties: TriggerProperties;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.TriggerProperties">TriggerProperties</a>

---

### TriggeredFlowBaseProps <a name="TriggeredFlowBaseProps" id="@cdklabs/cdk-appflow.TriggeredFlowBaseProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.TriggeredFlowBaseProps.Initializer"></a>

```typescript
import { TriggeredFlowBaseProps } from '@cdklabs/cdk-appflow'

const triggeredFlowBaseProps: TriggeredFlowBaseProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBaseProps.property.destination">destination</a></code> | <code><a href="#@cdklabs/cdk-appflow.IDestination">IDestination</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBaseProps.property.mappings">mappings</a></code> | <code><a href="#@cdklabs/cdk-appflow.IMapping">IMapping</a>[]</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBaseProps.property.source">source</a></code> | <code><a href="#@cdklabs/cdk-appflow.ISource">ISource</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBaseProps.property.description">description</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBaseProps.property.filters">filters</a></code> | <code><a href="#@cdklabs/cdk-appflow.IFilter">IFilter</a>[]</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBaseProps.property.key">key</a></code> | <code>aws-cdk-lib.aws_kms.IKey</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBaseProps.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBaseProps.property.transforms">transforms</a></code> | <code><a href="#@cdklabs/cdk-appflow.ITransform">ITransform</a>[]</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBaseProps.property.validations">validations</a></code> | <code><a href="#@cdklabs/cdk-appflow.IValidation">IValidation</a>[]</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.TriggeredFlowBaseProps.property.autoActivate">autoActivate</a></code> | <code>boolean</code> | *No description.* |

---

##### `destination`<sup>Required</sup> <a name="destination" id="@cdklabs/cdk-appflow.TriggeredFlowBaseProps.property.destination"></a>

```typescript
public readonly destination: IDestination;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.IDestination">IDestination</a>

---

##### `mappings`<sup>Required</sup> <a name="mappings" id="@cdklabs/cdk-appflow.TriggeredFlowBaseProps.property.mappings"></a>

```typescript
public readonly mappings: IMapping[];
```

- *Type:* <a href="#@cdklabs/cdk-appflow.IMapping">IMapping</a>[]

---

##### `source`<sup>Required</sup> <a name="source" id="@cdklabs/cdk-appflow.TriggeredFlowBaseProps.property.source"></a>

```typescript
public readonly source: ISource;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ISource">ISource</a>

---

##### `description`<sup>Optional</sup> <a name="description" id="@cdklabs/cdk-appflow.TriggeredFlowBaseProps.property.description"></a>

```typescript
public readonly description: string;
```

- *Type:* string

---

##### `filters`<sup>Optional</sup> <a name="filters" id="@cdklabs/cdk-appflow.TriggeredFlowBaseProps.property.filters"></a>

```typescript
public readonly filters: IFilter[];
```

- *Type:* <a href="#@cdklabs/cdk-appflow.IFilter">IFilter</a>[]

---

##### `key`<sup>Optional</sup> <a name="key" id="@cdklabs/cdk-appflow.TriggeredFlowBaseProps.property.key"></a>

```typescript
public readonly key: IKey;
```

- *Type:* aws-cdk-lib.aws_kms.IKey

---

##### `name`<sup>Optional</sup> <a name="name" id="@cdklabs/cdk-appflow.TriggeredFlowBaseProps.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `transforms`<sup>Optional</sup> <a name="transforms" id="@cdklabs/cdk-appflow.TriggeredFlowBaseProps.property.transforms"></a>

```typescript
public readonly transforms: ITransform[];
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ITransform">ITransform</a>[]

---

##### `validations`<sup>Optional</sup> <a name="validations" id="@cdklabs/cdk-appflow.TriggeredFlowBaseProps.property.validations"></a>

```typescript
public readonly validations: IValidation[];
```

- *Type:* <a href="#@cdklabs/cdk-appflow.IValidation">IValidation</a>[]

---

##### `autoActivate`<sup>Optional</sup> <a name="autoActivate" id="@cdklabs/cdk-appflow.TriggeredFlowBaseProps.property.autoActivate"></a>

```typescript
public readonly autoActivate: boolean;
```

- *Type:* boolean

---

### TriggerProperties <a name="TriggerProperties" id="@cdklabs/cdk-appflow.TriggerProperties"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.TriggerProperties.Initializer"></a>

```typescript
import { TriggerProperties } from '@cdklabs/cdk-appflow'

const triggerProperties: TriggerProperties = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.TriggerProperties.property.dataPullConfig">dataPullConfig</a></code> | <code><a href="#@cdklabs/cdk-appflow.DataPullConfig">DataPullConfig</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.TriggerProperties.property.schedule">schedule</a></code> | <code>aws-cdk-lib.aws_events.Schedule</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.TriggerProperties.property.flowErrorDeactivationThreshold">flowErrorDeactivationThreshold</a></code> | <code>number</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.TriggerProperties.property.properties">properties</a></code> | <code><a href="#@cdklabs/cdk-appflow.ScheduleProperties">ScheduleProperties</a></code> | *No description.* |

---

##### `dataPullConfig`<sup>Required</sup> <a name="dataPullConfig" id="@cdklabs/cdk-appflow.TriggerProperties.property.dataPullConfig"></a>

```typescript
public readonly dataPullConfig: DataPullConfig;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.DataPullConfig">DataPullConfig</a>

---

##### `schedule`<sup>Required</sup> <a name="schedule" id="@cdklabs/cdk-appflow.TriggerProperties.property.schedule"></a>

```typescript
public readonly schedule: Schedule;
```

- *Type:* aws-cdk-lib.aws_events.Schedule

---

##### `flowErrorDeactivationThreshold`<sup>Optional</sup> <a name="flowErrorDeactivationThreshold" id="@cdklabs/cdk-appflow.TriggerProperties.property.flowErrorDeactivationThreshold"></a>

```typescript
public readonly flowErrorDeactivationThreshold: number;
```

- *Type:* number

---

##### `properties`<sup>Optional</sup> <a name="properties" id="@cdklabs/cdk-appflow.TriggerProperties.property.properties"></a>

```typescript
public readonly properties: ScheduleProperties;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ScheduleProperties">ScheduleProperties</a>

---

### ZendeskConnectorProfileProps <a name="ZendeskConnectorProfileProps" id="@cdklabs/cdk-appflow.ZendeskConnectorProfileProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.ZendeskConnectorProfileProps.Initializer"></a>

```typescript
import { ZendeskConnectorProfileProps } from '@cdklabs/cdk-appflow'

const zendeskConnectorProfileProps: ZendeskConnectorProfileProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskConnectorProfileProps.property.key">key</a></code> | <code>aws-cdk-lib.aws_kms.IKey</code> | TODO: think if this should be here as not all connector profiles have that. |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskConnectorProfileProps.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskConnectorProfileProps.property.instanceUrl">instanceUrl</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskConnectorProfileProps.property.oAuth">oAuth</a></code> | <code><a href="#@cdklabs/cdk-appflow.ZendeskOAuthSettings">ZendeskOAuthSettings</a></code> | *No description.* |

---

##### `key`<sup>Optional</sup> <a name="key" id="@cdklabs/cdk-appflow.ZendeskConnectorProfileProps.property.key"></a>

```typescript
public readonly key: IKey;
```

- *Type:* aws-cdk-lib.aws_kms.IKey

TODO: think if this should be here as not all connector profiles have that.

---

##### `name`<sup>Optional</sup> <a name="name" id="@cdklabs/cdk-appflow.ZendeskConnectorProfileProps.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `instanceUrl`<sup>Required</sup> <a name="instanceUrl" id="@cdklabs/cdk-appflow.ZendeskConnectorProfileProps.property.instanceUrl"></a>

```typescript
public readonly instanceUrl: string;
```

- *Type:* string

---

##### `oAuth`<sup>Required</sup> <a name="oAuth" id="@cdklabs/cdk-appflow.ZendeskConnectorProfileProps.property.oAuth"></a>

```typescript
public readonly oAuth: ZendeskOAuthSettings;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ZendeskOAuthSettings">ZendeskOAuthSettings</a>

---

### ZendeskOAuthSettings <a name="ZendeskOAuthSettings" id="@cdklabs/cdk-appflow.ZendeskOAuthSettings"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.ZendeskOAuthSettings.Initializer"></a>

```typescript
import { ZendeskOAuthSettings } from '@cdklabs/cdk-appflow'

const zendeskOAuthSettings: ZendeskOAuthSettings = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskOAuthSettings.property.clientId">clientId</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskOAuthSettings.property.clientSecret">clientSecret</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskOAuthSettings.property.accessToken">accessToken</a></code> | <code>string</code> | *No description.* |

---

##### `clientId`<sup>Required</sup> <a name="clientId" id="@cdklabs/cdk-appflow.ZendeskOAuthSettings.property.clientId"></a>

```typescript
public readonly clientId: string;
```

- *Type:* string

---

##### `clientSecret`<sup>Required</sup> <a name="clientSecret" id="@cdklabs/cdk-appflow.ZendeskOAuthSettings.property.clientSecret"></a>

```typescript
public readonly clientSecret: string;
```

- *Type:* string

---

##### `accessToken`<sup>Optional</sup> <a name="accessToken" id="@cdklabs/cdk-appflow.ZendeskOAuthSettings.property.accessToken"></a>

```typescript
public readonly accessToken: string;
```

- *Type:* string

---

### ZendeskSourceProps <a name="ZendeskSourceProps" id="@cdklabs/cdk-appflow.ZendeskSourceProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-appflow.ZendeskSourceProps.Initializer"></a>

```typescript
import { ZendeskSourceProps } from '@cdklabs/cdk-appflow'

const zendeskSourceProps: ZendeskSourceProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskSourceProps.property.object">object</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskSourceProps.property.profile">profile</a></code> | <code><a href="#@cdklabs/cdk-appflow.ZendeskConnectorProfile">ZendeskConnectorProfile</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskSourceProps.property.apiVersion">apiVersion</a></code> | <code>string</code> | *No description.* |

---

##### `object`<sup>Required</sup> <a name="object" id="@cdklabs/cdk-appflow.ZendeskSourceProps.property.object"></a>

```typescript
public readonly object: string;
```

- *Type:* string

---

##### `profile`<sup>Required</sup> <a name="profile" id="@cdklabs/cdk-appflow.ZendeskSourceProps.property.profile"></a>

```typescript
public readonly profile: ZendeskConnectorProfile;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ZendeskConnectorProfile">ZendeskConnectorProfile</a>

---

##### `apiVersion`<sup>Optional</sup> <a name="apiVersion" id="@cdklabs/cdk-appflow.ZendeskSourceProps.property.apiVersion"></a>

```typescript
public readonly apiVersion: string;
```

- *Type:* string

---

## Classes <a name="Classes" id="Classes"></a>

### ConnectorType <a name="ConnectorType" id="@cdklabs/cdk-appflow.ConnectorType"></a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.ConnectorType.Initializer"></a>

```typescript
import { ConnectorType } from '@cdklabs/cdk-appflow'

new ConnectorType(name: string, isCustom: boolean)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ConnectorType.Initializer.parameter.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ConnectorType.Initializer.parameter.isCustom">isCustom</a></code> | <code>boolean</code> | *No description.* |

---

##### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.ConnectorType.Initializer.parameter.name"></a>

- *Type:* string

---

##### `isCustom`<sup>Required</sup> <a name="isCustom" id="@cdklabs/cdk-appflow.ConnectorType.Initializer.parameter.isCustom"></a>

- *Type:* boolean

---



#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ConnectorType.property.asProfileConnectorType">asProfileConnectorType</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ConnectorType.property.asTaskConnectorOperatorOrigin">asTaskConnectorOperatorOrigin</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ConnectorType.property.isCustom">isCustom</a></code> | <code>boolean</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ConnectorType.property.asProfileConnectorLabel">asProfileConnectorLabel</a></code> | <code>string</code> | *No description.* |

---

##### `asProfileConnectorType`<sup>Required</sup> <a name="asProfileConnectorType" id="@cdklabs/cdk-appflow.ConnectorType.property.asProfileConnectorType"></a>

```typescript
public readonly asProfileConnectorType: string;
```

- *Type:* string

---

##### `asTaskConnectorOperatorOrigin`<sup>Required</sup> <a name="asTaskConnectorOperatorOrigin" id="@cdklabs/cdk-appflow.ConnectorType.property.asTaskConnectorOperatorOrigin"></a>

```typescript
public readonly asTaskConnectorOperatorOrigin: string;
```

- *Type:* string

---

##### `isCustom`<sup>Required</sup> <a name="isCustom" id="@cdklabs/cdk-appflow.ConnectorType.property.isCustom"></a>

```typescript
public readonly isCustom: boolean;
```

- *Type:* boolean

---

##### `asProfileConnectorLabel`<sup>Optional</sup> <a name="asProfileConnectorLabel" id="@cdklabs/cdk-appflow.ConnectorType.property.asProfileConnectorLabel"></a>

```typescript
public readonly asProfileConnectorLabel: string;
```

- *Type:* string

---


### EventBridgeDestination <a name="EventBridgeDestination" id="@cdklabs/cdk-appflow.EventBridgeDestination"></a>

- *Implements:* <a href="#@cdklabs/cdk-appflow.IDestination">IDestination</a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.EventBridgeDestination.Initializer"></a>

```typescript
import { EventBridgeDestination } from '@cdklabs/cdk-appflow'

new EventBridgeDestination(props: EventBridgeDestinationProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.EventBridgeDestination.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.EventBridgeDestinationProps">EventBridgeDestinationProps</a></code> | *No description.* |

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.EventBridgeDestination.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.EventBridgeDestinationProps">EventBridgeDestinationProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.EventBridgeDestination.bind">bind</a></code> | *No description.* |

---

##### `bind` <a name="bind" id="@cdklabs/cdk-appflow.EventBridgeDestination.bind"></a>

```typescript
public bind(flow: IFlow): DestinationFlowConfigProperty
```

###### `flow`<sup>Required</sup> <a name="flow" id="@cdklabs/cdk-appflow.EventBridgeDestination.bind.parameter.flow"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

---


#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.EventBridgeDestination.property.connectorType">connectorType</a></code> | <code><a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a></code> | The AppFlow type of the connector that this source is implemented for. |

---

##### `connectorType`<sup>Required</sup> <a name="connectorType" id="@cdklabs/cdk-appflow.EventBridgeDestination.property.connectorType"></a>

```typescript
public readonly connectorType: ConnectorType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a>

The AppFlow type of the connector that this source is implemented for.

---


### EventSources <a name="EventSources" id="@cdklabs/cdk-appflow.EventSources"></a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.EventSources.Initializer"></a>

```typescript
import { EventSources } from '@cdklabs/cdk-appflow'

new EventSources()
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |

---


#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.EventSources.salesforceEventSource">salesforceEventSource</a></code> | *No description.* |

---

##### `salesforceEventSource` <a name="salesforceEventSource" id="@cdklabs/cdk-appflow.EventSources.salesforceEventSource"></a>

```typescript
import { EventSources } from '@cdklabs/cdk-appflow'

EventSources.salesforceEventSource(suffix?: string)
```

###### `suffix`<sup>Optional</sup> <a name="suffix" id="@cdklabs/cdk-appflow.EventSources.salesforceEventSource.parameter.suffix"></a>

- *Type:* string

---



### Filter <a name="Filter" id="@cdklabs/cdk-appflow.Filter"></a>

- *Implements:* <a href="#@cdklabs/cdk-appflow.IFilter">IFilter</a>

A representation of a mapping operation, that is an operation filtering records at the source.

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.Filter.Initializer"></a>

```typescript
import { Filter } from '@cdklabs/cdk-appflow'

new Filter(condition: FilterCondition)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.Filter.Initializer.parameter.condition">condition</a></code> | <code><a href="#@cdklabs/cdk-appflow.FilterCondition">FilterCondition</a></code> | *No description.* |

---

##### `condition`<sup>Required</sup> <a name="condition" id="@cdklabs/cdk-appflow.Filter.Initializer.parameter.condition"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.FilterCondition">FilterCondition</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.Filter.bind">bind</a></code> | *No description.* |

---

##### `bind` <a name="bind" id="@cdklabs/cdk-appflow.Filter.bind"></a>

```typescript
public bind(flow: IFlow, source: ISource): TaskProperty[]
```

###### `flow`<sup>Required</sup> <a name="flow" id="@cdklabs/cdk-appflow.Filter.bind.parameter.flow"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

---

###### `source`<sup>Required</sup> <a name="source" id="@cdklabs/cdk-appflow.Filter.bind.parameter.source"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.ISource">ISource</a>

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.Filter.when">when</a></code> | Builds a filter operation on source. |

---

##### `when` <a name="when" id="@cdklabs/cdk-appflow.Filter.when"></a>

```typescript
import { Filter } from '@cdklabs/cdk-appflow'

Filter.when(condition: FilterCondition)
```

Builds a filter operation on source.

> [FilterCondition instance](FilterCondition instance)

###### `condition`<sup>Required</sup> <a name="condition" id="@cdklabs/cdk-appflow.Filter.when.parameter.condition"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.FilterCondition">FilterCondition</a>

a.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.Filter.property.condition">condition</a></code> | <code><a href="#@cdklabs/cdk-appflow.FilterCondition">FilterCondition</a></code> | *No description.* |

---

##### `condition`<sup>Required</sup> <a name="condition" id="@cdklabs/cdk-appflow.Filter.property.condition"></a>

```typescript
public readonly condition: FilterCondition;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.FilterCondition">FilterCondition</a>

---


### FilterCondition <a name="FilterCondition" id="@cdklabs/cdk-appflow.FilterCondition"></a>

A representation of a filter operation condtiion on a source record field.

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.FilterCondition.Initializer"></a>

```typescript
import { FilterCondition } from '@cdklabs/cdk-appflow'

new FilterCondition(field: Field, filter: string, properties: TaskProperties)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.FilterCondition.Initializer.parameter.field">field</a></code> | <code><a href="#@cdklabs/cdk-appflow.Field">Field</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FilterCondition.Initializer.parameter.filter">filter</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FilterCondition.Initializer.parameter.properties">properties</a></code> | <code><a href="#@cdklabs/cdk-appflow.TaskProperties">TaskProperties</a></code> | *No description.* |

---

##### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.FilterCondition.Initializer.parameter.field"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

---

##### `filter`<sup>Required</sup> <a name="filter" id="@cdklabs/cdk-appflow.FilterCondition.Initializer.parameter.filter"></a>

- *Type:* string

---

##### `properties`<sup>Required</sup> <a name="properties" id="@cdklabs/cdk-appflow.FilterCondition.Initializer.parameter.properties"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.TaskProperties">TaskProperties</a>

---


#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.FilterCondition.booleanEquals">booleanEquals</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FilterCondition.booleanNotEquals">booleanNotEquals</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FilterCondition.numberEquals">numberEquals</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FilterCondition.numberGreaterThan">numberGreaterThan</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FilterCondition.numberGreaterThanEquals">numberGreaterThanEquals</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FilterCondition.numberLessThan">numberLessThan</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FilterCondition.numberLessThanEquals">numberLessThanEquals</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FilterCondition.numberNotEquals">numberNotEquals</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FilterCondition.stringContains">stringContains</a></code> | A condition testing whether a string-type source field contains the given value(s). |
| <code><a href="#@cdklabs/cdk-appflow.FilterCondition.stringEquals">stringEquals</a></code> | A condition testing whether a string-type source field equals the given value(s). |
| <code><a href="#@cdklabs/cdk-appflow.FilterCondition.stringNotEquals">stringNotEquals</a></code> | A condition testing whether a string-type source field does not equal the given value(s). |
| <code><a href="#@cdklabs/cdk-appflow.FilterCondition.timestampBetween">timestampBetween</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FilterCondition.timestampEquals">timestampEquals</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FilterCondition.timestampGreaterThan">timestampGreaterThan</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FilterCondition.timestampGreaterThanEquals">timestampGreaterThanEquals</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FilterCondition.timestampLessThan">timestampLessThan</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FilterCondition.timestampLessThanEquals">timestampLessThanEquals</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FilterCondition.timestampNotEquals">timestampNotEquals</a></code> | *No description.* |

---

##### `booleanEquals` <a name="booleanEquals" id="@cdklabs/cdk-appflow.FilterCondition.booleanEquals"></a>

```typescript
import { FilterCondition } from '@cdklabs/cdk-appflow'

FilterCondition.booleanEquals(field: Field, val: boolean | boolean[])
```

###### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.FilterCondition.booleanEquals.parameter.field"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

---

###### `val`<sup>Required</sup> <a name="val" id="@cdklabs/cdk-appflow.FilterCondition.booleanEquals.parameter.val"></a>

- *Type:* boolean | boolean[]

---

##### `booleanNotEquals` <a name="booleanNotEquals" id="@cdklabs/cdk-appflow.FilterCondition.booleanNotEquals"></a>

```typescript
import { FilterCondition } from '@cdklabs/cdk-appflow'

FilterCondition.booleanNotEquals(field: Field, val: boolean | boolean[])
```

###### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.FilterCondition.booleanNotEquals.parameter.field"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

---

###### `val`<sup>Required</sup> <a name="val" id="@cdklabs/cdk-appflow.FilterCondition.booleanNotEquals.parameter.val"></a>

- *Type:* boolean | boolean[]

---

##### `numberEquals` <a name="numberEquals" id="@cdklabs/cdk-appflow.FilterCondition.numberEquals"></a>

```typescript
import { FilterCondition } from '@cdklabs/cdk-appflow'

FilterCondition.numberEquals(field: Field, val: number | number[])
```

###### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.FilterCondition.numberEquals.parameter.field"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

---

###### `val`<sup>Required</sup> <a name="val" id="@cdklabs/cdk-appflow.FilterCondition.numberEquals.parameter.val"></a>

- *Type:* number | number[]

---

##### `numberGreaterThan` <a name="numberGreaterThan" id="@cdklabs/cdk-appflow.FilterCondition.numberGreaterThan"></a>

```typescript
import { FilterCondition } from '@cdklabs/cdk-appflow'

FilterCondition.numberGreaterThan(field: Field, val: number)
```

###### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.FilterCondition.numberGreaterThan.parameter.field"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

---

###### `val`<sup>Required</sup> <a name="val" id="@cdklabs/cdk-appflow.FilterCondition.numberGreaterThan.parameter.val"></a>

- *Type:* number

---

##### `numberGreaterThanEquals` <a name="numberGreaterThanEquals" id="@cdklabs/cdk-appflow.FilterCondition.numberGreaterThanEquals"></a>

```typescript
import { FilterCondition } from '@cdklabs/cdk-appflow'

FilterCondition.numberGreaterThanEquals(field: Field, val: number)
```

###### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.FilterCondition.numberGreaterThanEquals.parameter.field"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

---

###### `val`<sup>Required</sup> <a name="val" id="@cdklabs/cdk-appflow.FilterCondition.numberGreaterThanEquals.parameter.val"></a>

- *Type:* number

---

##### `numberLessThan` <a name="numberLessThan" id="@cdklabs/cdk-appflow.FilterCondition.numberLessThan"></a>

```typescript
import { FilterCondition } from '@cdklabs/cdk-appflow'

FilterCondition.numberLessThan(field: Field, val: number)
```

###### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.FilterCondition.numberLessThan.parameter.field"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

---

###### `val`<sup>Required</sup> <a name="val" id="@cdklabs/cdk-appflow.FilterCondition.numberLessThan.parameter.val"></a>

- *Type:* number

---

##### `numberLessThanEquals` <a name="numberLessThanEquals" id="@cdklabs/cdk-appflow.FilterCondition.numberLessThanEquals"></a>

```typescript
import { FilterCondition } from '@cdklabs/cdk-appflow'

FilterCondition.numberLessThanEquals(field: Field, val: number)
```

###### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.FilterCondition.numberLessThanEquals.parameter.field"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

---

###### `val`<sup>Required</sup> <a name="val" id="@cdklabs/cdk-appflow.FilterCondition.numberLessThanEquals.parameter.val"></a>

- *Type:* number

---

##### `numberNotEquals` <a name="numberNotEquals" id="@cdklabs/cdk-appflow.FilterCondition.numberNotEquals"></a>

```typescript
import { FilterCondition } from '@cdklabs/cdk-appflow'

FilterCondition.numberNotEquals(field: Field, val: number | number[])
```

###### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.FilterCondition.numberNotEquals.parameter.field"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

---

###### `val`<sup>Required</sup> <a name="val" id="@cdklabs/cdk-appflow.FilterCondition.numberNotEquals.parameter.val"></a>

- *Type:* number | number[]

---

##### `stringContains` <a name="stringContains" id="@cdklabs/cdk-appflow.FilterCondition.stringContains"></a>

```typescript
import { FilterCondition } from '@cdklabs/cdk-appflow'

FilterCondition.stringContains(field: Field, val: string | string[])
```

A condition testing whether a string-type source field contains the given value(s).

NOTE: When multiple values are passed the evaluation is resolved as logical OR

> [FilterCondition](FilterCondition)

###### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.FilterCondition.stringContains.parameter.field"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

a source field of a string type.

---

###### `val`<sup>Required</sup> <a name="val" id="@cdklabs/cdk-appflow.FilterCondition.stringContains.parameter.val"></a>

- *Type:* string | string[]

a value (or values) to be contained by the field value.

---

##### `stringEquals` <a name="stringEquals" id="@cdklabs/cdk-appflow.FilterCondition.stringEquals"></a>

```typescript
import { FilterCondition } from '@cdklabs/cdk-appflow'

FilterCondition.stringEquals(field: Field, val: string | string[])
```

A condition testing whether a string-type source field equals the given value(s).

NOTE: When multiple values are passed the evaluation is resolved as logical OR

> [FilterCondition](FilterCondition)

###### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.FilterCondition.stringEquals.parameter.field"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

a source field of a string type.

---

###### `val`<sup>Required</sup> <a name="val" id="@cdklabs/cdk-appflow.FilterCondition.stringEquals.parameter.val"></a>

- *Type:* string | string[]

a value (or values) to be contained by the field value.

---

##### `stringNotEquals` <a name="stringNotEquals" id="@cdklabs/cdk-appflow.FilterCondition.stringNotEquals"></a>

```typescript
import { FilterCondition } from '@cdklabs/cdk-appflow'

FilterCondition.stringNotEquals(field: Field, val: string | string[])
```

A condition testing whether a string-type source field does not equal the given value(s).

NOTE: When multiple values are passed the evaluation is resolved as logical OR

> [FilterCondition](FilterCondition)

###### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.FilterCondition.stringNotEquals.parameter.field"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

a source field of a string type.

---

###### `val`<sup>Required</sup> <a name="val" id="@cdklabs/cdk-appflow.FilterCondition.stringNotEquals.parameter.val"></a>

- *Type:* string | string[]

a value (or values) to be contained by the field value.

---

##### `timestampBetween` <a name="timestampBetween" id="@cdklabs/cdk-appflow.FilterCondition.timestampBetween"></a>

```typescript
import { FilterCondition } from '@cdklabs/cdk-appflow'

FilterCondition.timestampBetween(field: Field, lower: Date, upper: Date)
```

###### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.FilterCondition.timestampBetween.parameter.field"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

---

###### `lower`<sup>Required</sup> <a name="lower" id="@cdklabs/cdk-appflow.FilterCondition.timestampBetween.parameter.lower"></a>

- *Type:* Date

---

###### `upper`<sup>Required</sup> <a name="upper" id="@cdklabs/cdk-appflow.FilterCondition.timestampBetween.parameter.upper"></a>

- *Type:* Date

---

##### `timestampEquals` <a name="timestampEquals" id="@cdklabs/cdk-appflow.FilterCondition.timestampEquals"></a>

```typescript
import { FilterCondition } from '@cdklabs/cdk-appflow'

FilterCondition.timestampEquals(field: Field, val: Date | Date[])
```

###### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.FilterCondition.timestampEquals.parameter.field"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

---

###### `val`<sup>Required</sup> <a name="val" id="@cdklabs/cdk-appflow.FilterCondition.timestampEquals.parameter.val"></a>

- *Type:* Date | Date[]

---

##### `timestampGreaterThan` <a name="timestampGreaterThan" id="@cdklabs/cdk-appflow.FilterCondition.timestampGreaterThan"></a>

```typescript
import { FilterCondition } from '@cdklabs/cdk-appflow'

FilterCondition.timestampGreaterThan(field: Field, val: Date | Date[])
```

###### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.FilterCondition.timestampGreaterThan.parameter.field"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

---

###### `val`<sup>Required</sup> <a name="val" id="@cdklabs/cdk-appflow.FilterCondition.timestampGreaterThan.parameter.val"></a>

- *Type:* Date | Date[]

---

##### `timestampGreaterThanEquals` <a name="timestampGreaterThanEquals" id="@cdklabs/cdk-appflow.FilterCondition.timestampGreaterThanEquals"></a>

```typescript
import { FilterCondition } from '@cdklabs/cdk-appflow'

FilterCondition.timestampGreaterThanEquals(field: Field, val: Date | Date[])
```

###### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.FilterCondition.timestampGreaterThanEquals.parameter.field"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

---

###### `val`<sup>Required</sup> <a name="val" id="@cdklabs/cdk-appflow.FilterCondition.timestampGreaterThanEquals.parameter.val"></a>

- *Type:* Date | Date[]

---

##### `timestampLessThan` <a name="timestampLessThan" id="@cdklabs/cdk-appflow.FilterCondition.timestampLessThan"></a>

```typescript
import { FilterCondition } from '@cdklabs/cdk-appflow'

FilterCondition.timestampLessThan(field: Field, val: Date | Date[])
```

###### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.FilterCondition.timestampLessThan.parameter.field"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

---

###### `val`<sup>Required</sup> <a name="val" id="@cdklabs/cdk-appflow.FilterCondition.timestampLessThan.parameter.val"></a>

- *Type:* Date | Date[]

---

##### `timestampLessThanEquals` <a name="timestampLessThanEquals" id="@cdklabs/cdk-appflow.FilterCondition.timestampLessThanEquals"></a>

```typescript
import { FilterCondition } from '@cdklabs/cdk-appflow'

FilterCondition.timestampLessThanEquals(field: Field, val: Date | Date[])
```

###### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.FilterCondition.timestampLessThanEquals.parameter.field"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

---

###### `val`<sup>Required</sup> <a name="val" id="@cdklabs/cdk-appflow.FilterCondition.timestampLessThanEquals.parameter.val"></a>

- *Type:* Date | Date[]

---

##### `timestampNotEquals` <a name="timestampNotEquals" id="@cdklabs/cdk-appflow.FilterCondition.timestampNotEquals"></a>

```typescript
import { FilterCondition } from '@cdklabs/cdk-appflow'

FilterCondition.timestampNotEquals(field: Field, val: Date | Date[])
```

###### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.FilterCondition.timestampNotEquals.parameter.field"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

---

###### `val`<sup>Required</sup> <a name="val" id="@cdklabs/cdk-appflow.FilterCondition.timestampNotEquals.parameter.val"></a>

- *Type:* Date | Date[]

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.FilterCondition.property.field">field</a></code> | <code><a href="#@cdklabs/cdk-appflow.Field">Field</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FilterCondition.property.filter">filter</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FilterCondition.property.properties">properties</a></code> | <code><a href="#@cdklabs/cdk-appflow.TaskProperties">TaskProperties</a></code> | *No description.* |

---

##### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.FilterCondition.property.field"></a>

```typescript
public readonly field: Field;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

---

##### `filter`<sup>Required</sup> <a name="filter" id="@cdklabs/cdk-appflow.FilterCondition.property.filter"></a>

```typescript
public readonly filter: string;
```

- *Type:* string

---

##### `properties`<sup>Required</sup> <a name="properties" id="@cdklabs/cdk-appflow.FilterCondition.property.properties"></a>

```typescript
public readonly properties: TaskProperties;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.TaskProperties">TaskProperties</a>

---


### GoogleAnalytics4Source <a name="GoogleAnalytics4Source" id="@cdklabs/cdk-appflow.GoogleAnalytics4Source"></a>

- *Implements:* <a href="#@cdklabs/cdk-appflow.ISource">ISource</a>

A class that represents a Google Analytics v4 Source.

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.GoogleAnalytics4Source.Initializer"></a>

```typescript
import { GoogleAnalytics4Source } from '@cdklabs/cdk-appflow'

new GoogleAnalytics4Source(props: GoogleAnalytics4SourceProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4Source.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4SourceProps">GoogleAnalytics4SourceProps</a></code> | *No description.* |

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.GoogleAnalytics4Source.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.GoogleAnalytics4SourceProps">GoogleAnalytics4SourceProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4Source.bind">bind</a></code> | *No description.* |

---

##### `bind` <a name="bind" id="@cdklabs/cdk-appflow.GoogleAnalytics4Source.bind"></a>

```typescript
public bind(scope: IFlow): SourceFlowConfigProperty
```

###### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.GoogleAnalytics4Source.bind.parameter.scope"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

---


#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4Source.property.connectorType">connectorType</a></code> | <code><a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a></code> | The AppFlow type of the connector that this source is implemented for. |

---

##### `connectorType`<sup>Required</sup> <a name="connectorType" id="@cdklabs/cdk-appflow.GoogleAnalytics4Source.property.connectorType"></a>

```typescript
public readonly connectorType: ConnectorType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a>

The AppFlow type of the connector that this source is implemented for.

---


### Mapping <a name="Mapping" id="@cdklabs/cdk-appflow.Mapping"></a>

- *Implements:* <a href="#@cdklabs/cdk-appflow.IMapping">IMapping</a>

A representation of an instance of a mapping operation, that is an operation translating source to destination fields.

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.Mapping.Initializer"></a>

```typescript
import { Mapping } from '@cdklabs/cdk-appflow'

new Mapping(tasks: ITask[])
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.Mapping.Initializer.parameter.tasks">tasks</a></code> | <code><a href="#@cdklabs/cdk-appflow.ITask">ITask</a>[]</code> | *No description.* |

---

##### `tasks`<sup>Required</sup> <a name="tasks" id="@cdklabs/cdk-appflow.Mapping.Initializer.parameter.tasks"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.ITask">ITask</a>[]

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.Mapping.bind">bind</a></code> | *No description.* |

---

##### `bind` <a name="bind" id="@cdklabs/cdk-appflow.Mapping.bind"></a>

```typescript
public bind(flow: IFlow, source: ISource): TaskProperty[]
```

###### `flow`<sup>Required</sup> <a name="flow" id="@cdklabs/cdk-appflow.Mapping.bind.parameter.flow"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

---

###### `source`<sup>Required</sup> <a name="source" id="@cdklabs/cdk-appflow.Mapping.bind.parameter.source"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.ISource">ISource</a>

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.Mapping.add">add</a></code> | Specifies an addition mapping of two numeric values from asource to a destination. |
| <code><a href="#@cdklabs/cdk-appflow.Mapping.concat">concat</a></code> | A mapping definition building concatenation of source fields into a destination field. |
| <code><a href="#@cdklabs/cdk-appflow.Mapping.divide">divide</a></code> | Specifies a division mapping of two numeric values from a source to a destination. |
| <code><a href="#@cdklabs/cdk-appflow.Mapping.map">map</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.Mapping.mapAll">mapAll</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.Mapping.multiply">multiply</a></code> | Specifies a multiplication mapping of two numeric values from a source to a destination. |
| <code><a href="#@cdklabs/cdk-appflow.Mapping.subtract">subtract</a></code> | Specifies a subtraction mapping of two numeric values from a source to a destination. |

---

##### `add` <a name="add" id="@cdklabs/cdk-appflow.Mapping.add"></a>

```typescript
import { Mapping } from '@cdklabs/cdk-appflow'

Mapping.add(sourceField1: Field, sourceField2: Field, to: Field)
```

Specifies an addition mapping of two numeric values from asource to a destination.

###### `sourceField1`<sup>Required</sup> <a name="sourceField1" id="@cdklabs/cdk-appflow.Mapping.add.parameter.sourceField1"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

a numeric value.

---

###### `sourceField2`<sup>Required</sup> <a name="sourceField2" id="@cdklabs/cdk-appflow.Mapping.add.parameter.sourceField2"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

a numeric value.

---

###### `to`<sup>Required</sup> <a name="to" id="@cdklabs/cdk-appflow.Mapping.add.parameter.to"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

a numeric value.

---

##### `concat` <a name="concat" id="@cdklabs/cdk-appflow.Mapping.concat"></a>

```typescript
import { Mapping } from '@cdklabs/cdk-appflow'

Mapping.concat(from: Field[], to: Field, format: string)
```

A mapping definition building concatenation of source fields into a destination field.

###### `from`<sup>Required</sup> <a name="from" id="@cdklabs/cdk-appflow.Mapping.concat.parameter.from"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>[]

an array of source fields.

---

###### `to`<sup>Required</sup> <a name="to" id="@cdklabs/cdk-appflow.Mapping.concat.parameter.to"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

a desintation field.

---

###### `format`<sup>Required</sup> <a name="format" id="@cdklabs/cdk-appflow.Mapping.concat.parameter.format"></a>

- *Type:* string

a format.

---

##### `divide` <a name="divide" id="@cdklabs/cdk-appflow.Mapping.divide"></a>

```typescript
import { Mapping } from '@cdklabs/cdk-appflow'

Mapping.divide(sourceField1: Field, sourceField2: Field, to: Field)
```

Specifies a division mapping of two numeric values from a source to a destination.

###### `sourceField1`<sup>Required</sup> <a name="sourceField1" id="@cdklabs/cdk-appflow.Mapping.divide.parameter.sourceField1"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

a numeric value.

---

###### `sourceField2`<sup>Required</sup> <a name="sourceField2" id="@cdklabs/cdk-appflow.Mapping.divide.parameter.sourceField2"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

a numeric value.

---

###### `to`<sup>Required</sup> <a name="to" id="@cdklabs/cdk-appflow.Mapping.divide.parameter.to"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

a numeric value.

---

##### `map` <a name="map" id="@cdklabs/cdk-appflow.Mapping.map"></a>

```typescript
import { Mapping } from '@cdklabs/cdk-appflow'

Mapping.map(from: Field, to: Field)
```

###### `from`<sup>Required</sup> <a name="from" id="@cdklabs/cdk-appflow.Mapping.map.parameter.from"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

---

###### `to`<sup>Required</sup> <a name="to" id="@cdklabs/cdk-appflow.Mapping.map.parameter.to"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

---

##### `mapAll` <a name="mapAll" id="@cdklabs/cdk-appflow.Mapping.mapAll"></a>

```typescript
import { Mapping } from '@cdklabs/cdk-appflow'

Mapping.mapAll(config?: MapAllConfig)
```

###### `config`<sup>Optional</sup> <a name="config" id="@cdklabs/cdk-appflow.Mapping.mapAll.parameter.config"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.MapAllConfig">MapAllConfig</a>

---

##### `multiply` <a name="multiply" id="@cdklabs/cdk-appflow.Mapping.multiply"></a>

```typescript
import { Mapping } from '@cdklabs/cdk-appflow'

Mapping.multiply(sourceField1: Field, sourceField2: Field, to: Field)
```

Specifies a multiplication mapping of two numeric values from a source to a destination.

###### `sourceField1`<sup>Required</sup> <a name="sourceField1" id="@cdklabs/cdk-appflow.Mapping.multiply.parameter.sourceField1"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

a numeric value.

---

###### `sourceField2`<sup>Required</sup> <a name="sourceField2" id="@cdklabs/cdk-appflow.Mapping.multiply.parameter.sourceField2"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

a numeric value.

---

###### `to`<sup>Required</sup> <a name="to" id="@cdklabs/cdk-appflow.Mapping.multiply.parameter.to"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

a numeric value.

---

##### `subtract` <a name="subtract" id="@cdklabs/cdk-appflow.Mapping.subtract"></a>

```typescript
import { Mapping } from '@cdklabs/cdk-appflow'

Mapping.subtract(sourceField1: Field, sourceField2: Field, to: Field)
```

Specifies a subtraction mapping of two numeric values from a source to a destination.

###### `sourceField1`<sup>Required</sup> <a name="sourceField1" id="@cdklabs/cdk-appflow.Mapping.subtract.parameter.sourceField1"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

a numeric value.

---

###### `sourceField2`<sup>Required</sup> <a name="sourceField2" id="@cdklabs/cdk-appflow.Mapping.subtract.parameter.sourceField2"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

a numeric value.

---

###### `to`<sup>Required</sup> <a name="to" id="@cdklabs/cdk-appflow.Mapping.subtract.parameter.to"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.Field">Field</a>

a numeric value.

---



### MarketoInstanceUrlBuilder <a name="MarketoInstanceUrlBuilder" id="@cdklabs/cdk-appflow.MarketoInstanceUrlBuilder"></a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.MarketoInstanceUrlBuilder.Initializer"></a>

```typescript
import { MarketoInstanceUrlBuilder } from '@cdklabs/cdk-appflow'

new MarketoInstanceUrlBuilder()
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |

---


#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MarketoInstanceUrlBuilder.buildFromAccount">buildFromAccount</a></code> | *No description.* |

---

##### `buildFromAccount` <a name="buildFromAccount" id="@cdklabs/cdk-appflow.MarketoInstanceUrlBuilder.buildFromAccount"></a>

```typescript
import { MarketoInstanceUrlBuilder } from '@cdklabs/cdk-appflow'

MarketoInstanceUrlBuilder.buildFromAccount(account: string)
```

###### `account`<sup>Required</sup> <a name="account" id="@cdklabs/cdk-appflow.MarketoInstanceUrlBuilder.buildFromAccount.parameter.account"></a>

- *Type:* string

---



### MarketoSource <a name="MarketoSource" id="@cdklabs/cdk-appflow.MarketoSource"></a>

- *Implements:* <a href="#@cdklabs/cdk-appflow.ISource">ISource</a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.MarketoSource.Initializer"></a>

```typescript
import { MarketoSource } from '@cdklabs/cdk-appflow'

new MarketoSource(props: MarketoSourceProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MarketoSource.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.MarketoSourceProps">MarketoSourceProps</a></code> | *No description.* |

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.MarketoSource.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.MarketoSourceProps">MarketoSourceProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MarketoSource.bind">bind</a></code> | *No description.* |

---

##### `bind` <a name="bind" id="@cdklabs/cdk-appflow.MarketoSource.bind"></a>

```typescript
public bind(flow: IFlow): SourceFlowConfigProperty
```

###### `flow`<sup>Required</sup> <a name="flow" id="@cdklabs/cdk-appflow.MarketoSource.bind.parameter.flow"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

---


#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MarketoSource.property.connectorType">connectorType</a></code> | <code><a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a></code> | The AppFlow type of the connector that this source is implemented for. |

---

##### `connectorType`<sup>Required</sup> <a name="connectorType" id="@cdklabs/cdk-appflow.MarketoSource.property.connectorType"></a>

```typescript
public readonly connectorType: ConnectorType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a>

The AppFlow type of the connector that this source is implemented for.

---


### MicrosoftSharepointOnlineSource <a name="MicrosoftSharepointOnlineSource" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineSource"></a>

- *Implements:* <a href="#@cdklabs/cdk-appflow.ISource">ISource</a>

A class that represents a Google Analytics v4 Source.

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineSource.Initializer"></a>

```typescript
import { MicrosoftSharepointOnlineSource } from '@cdklabs/cdk-appflow'

new MicrosoftSharepointOnlineSource(props: MicrosoftSharepointOnlineSourceProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineSource.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineSourceProps">MicrosoftSharepointOnlineSourceProps</a></code> | *No description.* |

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineSource.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineSourceProps">MicrosoftSharepointOnlineSourceProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineSource.bind">bind</a></code> | *No description.* |

---

##### `bind` <a name="bind" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineSource.bind"></a>

```typescript
public bind(scope: IFlow): SourceFlowConfigProperty
```

###### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineSource.bind.parameter.scope"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

---


#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineSource.property.connectorType">connectorType</a></code> | <code><a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a></code> | The AppFlow type of the connector that this source is implemented for. |

---

##### `connectorType`<sup>Required</sup> <a name="connectorType" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineSource.property.connectorType"></a>

```typescript
public readonly connectorType: ConnectorType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a>

The AppFlow type of the connector that this source is implemented for.

---


### MicrosoftSharepointOnlineTokenUrlBuilder <a name="MicrosoftSharepointOnlineTokenUrlBuilder" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineTokenUrlBuilder"></a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineTokenUrlBuilder.Initializer"></a>

```typescript
import { MicrosoftSharepointOnlineTokenUrlBuilder } from '@cdklabs/cdk-appflow'

new MicrosoftSharepointOnlineTokenUrlBuilder()
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |

---


#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineTokenUrlBuilder.buildFromTenant">buildFromTenant</a></code> | *No description.* |

---

##### `buildFromTenant` <a name="buildFromTenant" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineTokenUrlBuilder.buildFromTenant"></a>

```typescript
import { MicrosoftSharepointOnlineTokenUrlBuilder } from '@cdklabs/cdk-appflow'

MicrosoftSharepointOnlineTokenUrlBuilder.buildFromTenant(tenantId: string)
```

###### `tenantId`<sup>Required</sup> <a name="tenantId" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineTokenUrlBuilder.buildFromTenant.parameter.tenantId"></a>

- *Type:* string

---



### OperationBase <a name="OperationBase" id="@cdklabs/cdk-appflow.OperationBase"></a>

- *Implements:* <a href="#@cdklabs/cdk-appflow.IOperation">IOperation</a>

A base class for all operations.

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.OperationBase.Initializer"></a>

```typescript
import { OperationBase } from '@cdklabs/cdk-appflow'

new OperationBase(tasks: ITask[])
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.OperationBase.Initializer.parameter.tasks">tasks</a></code> | <code><a href="#@cdklabs/cdk-appflow.ITask">ITask</a>[]</code> | *No description.* |

---

##### `tasks`<sup>Required</sup> <a name="tasks" id="@cdklabs/cdk-appflow.OperationBase.Initializer.parameter.tasks"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.ITask">ITask</a>[]

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.OperationBase.bind">bind</a></code> | *No description.* |

---

##### `bind` <a name="bind" id="@cdklabs/cdk-appflow.OperationBase.bind"></a>

```typescript
public bind(flow: IFlow, source: ISource): TaskProperty[]
```

###### `flow`<sup>Required</sup> <a name="flow" id="@cdklabs/cdk-appflow.OperationBase.bind.parameter.flow"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

---

###### `source`<sup>Required</sup> <a name="source" id="@cdklabs/cdk-appflow.OperationBase.bind.parameter.source"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.ISource">ISource</a>

---




### RedshiftDestination <a name="RedshiftDestination" id="@cdklabs/cdk-appflow.RedshiftDestination"></a>

- *Implements:* <a href="#@cdklabs/cdk-appflow.IDestination">IDestination</a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.RedshiftDestination.Initializer"></a>

```typescript
import { RedshiftDestination } from '@cdklabs/cdk-appflow'

new RedshiftDestination(props: RedshiftDestinationProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftDestination.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.RedshiftDestinationProps">RedshiftDestinationProps</a></code> | *No description.* |

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.RedshiftDestination.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.RedshiftDestinationProps">RedshiftDestinationProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftDestination.bind">bind</a></code> | *No description.* |

---

##### `bind` <a name="bind" id="@cdklabs/cdk-appflow.RedshiftDestination.bind"></a>

```typescript
public bind(scope: IFlow): DestinationFlowConfigProperty
```

###### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.RedshiftDestination.bind.parameter.scope"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

---


#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.RedshiftDestination.property.connectorType">connectorType</a></code> | <code><a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a></code> | The AppFlow type of the connector that this source is implemented for. |

---

##### `connectorType`<sup>Required</sup> <a name="connectorType" id="@cdklabs/cdk-appflow.RedshiftDestination.property.connectorType"></a>

```typescript
public readonly connectorType: ConnectorType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a>

The AppFlow type of the connector that this source is implemented for.

---


### S3Destination <a name="S3Destination" id="@cdklabs/cdk-appflow.S3Destination"></a>

- *Implements:* <a href="#@cdklabs/cdk-appflow.IDestination">IDestination</a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.S3Destination.Initializer"></a>

```typescript
import { S3Destination } from '@cdklabs/cdk-appflow'

new S3Destination(props: S3DestinationProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.S3Destination.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.S3DestinationProps">S3DestinationProps</a></code> | *No description.* |

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.S3Destination.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.S3DestinationProps">S3DestinationProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.S3Destination.bind">bind</a></code> | *No description.* |

---

##### `bind` <a name="bind" id="@cdklabs/cdk-appflow.S3Destination.bind"></a>

```typescript
public bind(flow: IFlow): DestinationFlowConfigProperty
```

###### `flow`<sup>Required</sup> <a name="flow" id="@cdklabs/cdk-appflow.S3Destination.bind.parameter.flow"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

---


#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.S3Destination.property.connectorType">connectorType</a></code> | <code><a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a></code> | The AppFlow type of the connector that this source is implemented for. |

---

##### `connectorType`<sup>Required</sup> <a name="connectorType" id="@cdklabs/cdk-appflow.S3Destination.property.connectorType"></a>

```typescript
public readonly connectorType: ConnectorType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a>

The AppFlow type of the connector that this source is implemented for.

---


### S3Source <a name="S3Source" id="@cdklabs/cdk-appflow.S3Source"></a>

- *Implements:* <a href="#@cdklabs/cdk-appflow.ISource">ISource</a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.S3Source.Initializer"></a>

```typescript
import { S3Source } from '@cdklabs/cdk-appflow'

new S3Source(props: S3SourceProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.S3Source.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.S3SourceProps">S3SourceProps</a></code> | *No description.* |

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.S3Source.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.S3SourceProps">S3SourceProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.S3Source.bind">bind</a></code> | *No description.* |

---

##### `bind` <a name="bind" id="@cdklabs/cdk-appflow.S3Source.bind"></a>

```typescript
public bind(scope: IFlow): SourceFlowConfigProperty
```

###### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.S3Source.bind.parameter.scope"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

---


#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.S3Source.property.connectorType">connectorType</a></code> | <code><a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a></code> | The AppFlow type of the connector that this source is implemented for. |

---

##### `connectorType`<sup>Required</sup> <a name="connectorType" id="@cdklabs/cdk-appflow.S3Source.property.connectorType"></a>

```typescript
public readonly connectorType: ConnectorType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a>

The AppFlow type of the connector that this source is implemented for.

---


### SalesforceDestination <a name="SalesforceDestination" id="@cdklabs/cdk-appflow.SalesforceDestination"></a>

- *Implements:* <a href="#@cdklabs/cdk-appflow.IDestination">IDestination</a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.SalesforceDestination.Initializer"></a>

```typescript
import { SalesforceDestination } from '@cdklabs/cdk-appflow'

new SalesforceDestination(props: SalesforceDestinationProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceDestination.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.SalesforceDestinationProps">SalesforceDestinationProps</a></code> | *No description.* |

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.SalesforceDestination.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.SalesforceDestinationProps">SalesforceDestinationProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceDestination.bind">bind</a></code> | *No description.* |

---

##### `bind` <a name="bind" id="@cdklabs/cdk-appflow.SalesforceDestination.bind"></a>

```typescript
public bind(flow: IFlow): DestinationFlowConfigProperty
```

###### `flow`<sup>Required</sup> <a name="flow" id="@cdklabs/cdk-appflow.SalesforceDestination.bind.parameter.flow"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

---


#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceDestination.property.connectorType">connectorType</a></code> | <code><a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a></code> | The AppFlow type of the connector that this source is implemented for. |

---

##### `connectorType`<sup>Required</sup> <a name="connectorType" id="@cdklabs/cdk-appflow.SalesforceDestination.property.connectorType"></a>

```typescript
public readonly connectorType: ConnectorType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a>

The AppFlow type of the connector that this source is implemented for.

---


### SalesforceMarketingCloudSource <a name="SalesforceMarketingCloudSource" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudSource"></a>

- *Implements:* <a href="#@cdklabs/cdk-appflow.ISource">ISource</a>

A class that represents a Salesforce Marketing Cloud Source.

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudSource.Initializer"></a>

```typescript
import { SalesforceMarketingCloudSource } from '@cdklabs/cdk-appflow'

new SalesforceMarketingCloudSource(props: SalesforceMarketingCloudSourceProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudSource.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudSourceProps">SalesforceMarketingCloudSourceProps</a></code> | *No description.* |

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudSource.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudSourceProps">SalesforceMarketingCloudSourceProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudSource.bind">bind</a></code> | *No description.* |

---

##### `bind` <a name="bind" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudSource.bind"></a>

```typescript
public bind(scope: IFlow): SourceFlowConfigProperty
```

###### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudSource.bind.parameter.scope"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

---


#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudSource.property.connectorType">connectorType</a></code> | <code><a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a></code> | The AppFlow type of the connector that this source is implemented for. |

---

##### `connectorType`<sup>Required</sup> <a name="connectorType" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudSource.property.connectorType"></a>

```typescript
public readonly connectorType: ConnectorType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a>

The AppFlow type of the connector that this source is implemented for.

---


### SalesforceSource <a name="SalesforceSource" id="@cdklabs/cdk-appflow.SalesforceSource"></a>

- *Implements:* <a href="#@cdklabs/cdk-appflow.ISource">ISource</a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.SalesforceSource.Initializer"></a>

```typescript
import { SalesforceSource } from '@cdklabs/cdk-appflow'

new SalesforceSource(props: SalesforceSourceProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceSource.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.SalesforceSourceProps">SalesforceSourceProps</a></code> | *No description.* |

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.SalesforceSource.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.SalesforceSourceProps">SalesforceSourceProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceSource.bind">bind</a></code> | *No description.* |

---

##### `bind` <a name="bind" id="@cdklabs/cdk-appflow.SalesforceSource.bind"></a>

```typescript
public bind(flow: IFlow): SourceFlowConfigProperty
```

###### `flow`<sup>Required</sup> <a name="flow" id="@cdklabs/cdk-appflow.SalesforceSource.bind.parameter.flow"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

---


#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceSource.property.connectorType">connectorType</a></code> | <code><a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a></code> | The AppFlow type of the connector that this source is implemented for. |

---

##### `connectorType`<sup>Required</sup> <a name="connectorType" id="@cdklabs/cdk-appflow.SalesforceSource.property.connectorType"></a>

```typescript
public readonly connectorType: ConnectorType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a>

The AppFlow type of the connector that this source is implemented for.

---


### SAPOdataDestination <a name="SAPOdataDestination" id="@cdklabs/cdk-appflow.SAPOdataDestination"></a>

- *Implements:* <a href="#@cdklabs/cdk-appflow.IDestination">IDestination</a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.SAPOdataDestination.Initializer"></a>

```typescript
import { SAPOdataDestination } from '@cdklabs/cdk-appflow'

new SAPOdataDestination(props: SAPOdataDestinationProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataDestination.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.SAPOdataDestinationProps">SAPOdataDestinationProps</a></code> | *No description.* |

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.SAPOdataDestination.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.SAPOdataDestinationProps">SAPOdataDestinationProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataDestination.bind">bind</a></code> | *No description.* |

---

##### `bind` <a name="bind" id="@cdklabs/cdk-appflow.SAPOdataDestination.bind"></a>

```typescript
public bind(flow: IFlow): DestinationFlowConfigProperty
```

###### `flow`<sup>Required</sup> <a name="flow" id="@cdklabs/cdk-appflow.SAPOdataDestination.bind.parameter.flow"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

---


#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataDestination.property.connectorType">connectorType</a></code> | <code><a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a></code> | The AppFlow type of the connector that this source is implemented for. |

---

##### `connectorType`<sup>Required</sup> <a name="connectorType" id="@cdklabs/cdk-appflow.SAPOdataDestination.property.connectorType"></a>

```typescript
public readonly connectorType: ConnectorType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a>

The AppFlow type of the connector that this source is implemented for.

---


### SAPOdataSource <a name="SAPOdataSource" id="@cdklabs/cdk-appflow.SAPOdataSource"></a>

- *Implements:* <a href="#@cdklabs/cdk-appflow.ISource">ISource</a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.SAPOdataSource.Initializer"></a>

```typescript
import { SAPOdataSource } from '@cdklabs/cdk-appflow'

new SAPOdataSource(props: SAPOdataSourceProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataSource.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.SAPOdataSourceProps">SAPOdataSourceProps</a></code> | *No description.* |

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.SAPOdataSource.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.SAPOdataSourceProps">SAPOdataSourceProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataSource.bind">bind</a></code> | *No description.* |

---

##### `bind` <a name="bind" id="@cdklabs/cdk-appflow.SAPOdataSource.bind"></a>

```typescript
public bind(flow: IFlow): SourceFlowConfigProperty
```

###### `flow`<sup>Required</sup> <a name="flow" id="@cdklabs/cdk-appflow.SAPOdataSource.bind.parameter.flow"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

---


#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SAPOdataSource.property.connectorType">connectorType</a></code> | <code><a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a></code> | The AppFlow type of the connector that this source is implemented for. |

---

##### `connectorType`<sup>Required</sup> <a name="connectorType" id="@cdklabs/cdk-appflow.SAPOdataSource.property.connectorType"></a>

```typescript
public readonly connectorType: ConnectorType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a>

The AppFlow type of the connector that this source is implemented for.

---


### ServiceNowInstanceUrlBuilder <a name="ServiceNowInstanceUrlBuilder" id="@cdklabs/cdk-appflow.ServiceNowInstanceUrlBuilder"></a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.ServiceNowInstanceUrlBuilder.Initializer"></a>

```typescript
import { ServiceNowInstanceUrlBuilder } from '@cdklabs/cdk-appflow'

new ServiceNowInstanceUrlBuilder()
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |

---


#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ServiceNowInstanceUrlBuilder.buildFromDomain">buildFromDomain</a></code> | *No description.* |

---

##### `buildFromDomain` <a name="buildFromDomain" id="@cdklabs/cdk-appflow.ServiceNowInstanceUrlBuilder.buildFromDomain"></a>

```typescript
import { ServiceNowInstanceUrlBuilder } from '@cdklabs/cdk-appflow'

ServiceNowInstanceUrlBuilder.buildFromDomain(domain: string)
```

###### `domain`<sup>Required</sup> <a name="domain" id="@cdklabs/cdk-appflow.ServiceNowInstanceUrlBuilder.buildFromDomain.parameter.domain"></a>

- *Type:* string

---



### ServiceNowSource <a name="ServiceNowSource" id="@cdklabs/cdk-appflow.ServiceNowSource"></a>

- *Implements:* <a href="#@cdklabs/cdk-appflow.ISource">ISource</a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.ServiceNowSource.Initializer"></a>

```typescript
import { ServiceNowSource } from '@cdklabs/cdk-appflow'

new ServiceNowSource(props: ServiceNowSourceProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ServiceNowSource.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.ServiceNowSourceProps">ServiceNowSourceProps</a></code> | *No description.* |

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.ServiceNowSource.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.ServiceNowSourceProps">ServiceNowSourceProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ServiceNowSource.bind">bind</a></code> | *No description.* |

---

##### `bind` <a name="bind" id="@cdklabs/cdk-appflow.ServiceNowSource.bind"></a>

```typescript
public bind(flow: IFlow): SourceFlowConfigProperty
```

###### `flow`<sup>Required</sup> <a name="flow" id="@cdklabs/cdk-appflow.ServiceNowSource.bind.parameter.flow"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

---


#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ServiceNowSource.property.connectorType">connectorType</a></code> | <code><a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a></code> | The AppFlow type of the connector that this source is implemented for. |

---

##### `connectorType`<sup>Required</sup> <a name="connectorType" id="@cdklabs/cdk-appflow.ServiceNowSource.property.connectorType"></a>

```typescript
public readonly connectorType: ConnectorType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a>

The AppFlow type of the connector that this source is implemented for.

---


### SlackInstanceUrlBuilder <a name="SlackInstanceUrlBuilder" id="@cdklabs/cdk-appflow.SlackInstanceUrlBuilder"></a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.SlackInstanceUrlBuilder.Initializer"></a>

```typescript
import { SlackInstanceUrlBuilder } from '@cdklabs/cdk-appflow'

new SlackInstanceUrlBuilder()
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |

---


#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SlackInstanceUrlBuilder.buildFromWorkspace">buildFromWorkspace</a></code> | *No description.* |

---

##### `buildFromWorkspace` <a name="buildFromWorkspace" id="@cdklabs/cdk-appflow.SlackInstanceUrlBuilder.buildFromWorkspace"></a>

```typescript
import { SlackInstanceUrlBuilder } from '@cdklabs/cdk-appflow'

SlackInstanceUrlBuilder.buildFromWorkspace(workspace: string)
```

###### `workspace`<sup>Required</sup> <a name="workspace" id="@cdklabs/cdk-appflow.SlackInstanceUrlBuilder.buildFromWorkspace.parameter.workspace"></a>

- *Type:* string

---



### SlackSource <a name="SlackSource" id="@cdklabs/cdk-appflow.SlackSource"></a>

- *Implements:* <a href="#@cdklabs/cdk-appflow.ISource">ISource</a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.SlackSource.Initializer"></a>

```typescript
import { SlackSource } from '@cdklabs/cdk-appflow'

new SlackSource(props: SlackSourceProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SlackSource.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.SlackSourceProps">SlackSourceProps</a></code> | *No description.* |

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.SlackSource.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.SlackSourceProps">SlackSourceProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SlackSource.bind">bind</a></code> | *No description.* |

---

##### `bind` <a name="bind" id="@cdklabs/cdk-appflow.SlackSource.bind"></a>

```typescript
public bind(flow: IFlow): SourceFlowConfigProperty
```

###### `flow`<sup>Required</sup> <a name="flow" id="@cdklabs/cdk-appflow.SlackSource.bind.parameter.flow"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

---


#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SlackSource.property.connectorType">connectorType</a></code> | <code><a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a></code> | The AppFlow type of the connector that this source is implemented for. |

---

##### `connectorType`<sup>Required</sup> <a name="connectorType" id="@cdklabs/cdk-appflow.SlackSource.property.connectorType"></a>

```typescript
public readonly connectorType: ConnectorType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a>

The AppFlow type of the connector that this source is implemented for.

---


### Task <a name="Task" id="@cdklabs/cdk-appflow.Task"></a>

- *Implements:* <a href="#@cdklabs/cdk-appflow.ITask">ITask</a>

A representation of a unitary action on the record fields.

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.Task.Initializer"></a>

```typescript
import { Task } from '@cdklabs/cdk-appflow'

new Task(type: string, sourceFields: string[], connectorOperator: TaskConnectorOperator, properties: TaskProperties, destinationField?: string)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.Task.Initializer.parameter.type">type</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.Task.Initializer.parameter.sourceFields">sourceFields</a></code> | <code>string[]</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.Task.Initializer.parameter.connectorOperator">connectorOperator</a></code> | <code><a href="#@cdklabs/cdk-appflow.TaskConnectorOperator">TaskConnectorOperator</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.Task.Initializer.parameter.properties">properties</a></code> | <code><a href="#@cdklabs/cdk-appflow.TaskProperties">TaskProperties</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.Task.Initializer.parameter.destinationField">destinationField</a></code> | <code>string</code> | *No description.* |

---

##### `type`<sup>Required</sup> <a name="type" id="@cdklabs/cdk-appflow.Task.Initializer.parameter.type"></a>

- *Type:* string

---

##### `sourceFields`<sup>Required</sup> <a name="sourceFields" id="@cdklabs/cdk-appflow.Task.Initializer.parameter.sourceFields"></a>

- *Type:* string[]

---

##### `connectorOperator`<sup>Required</sup> <a name="connectorOperator" id="@cdklabs/cdk-appflow.Task.Initializer.parameter.connectorOperator"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.TaskConnectorOperator">TaskConnectorOperator</a>

---

##### `properties`<sup>Required</sup> <a name="properties" id="@cdklabs/cdk-appflow.Task.Initializer.parameter.properties"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.TaskProperties">TaskProperties</a>

---

##### `destinationField`<sup>Optional</sup> <a name="destinationField" id="@cdklabs/cdk-appflow.Task.Initializer.parameter.destinationField"></a>

- *Type:* string

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.Task.bind">bind</a></code> | *No description.* |

---

##### `bind` <a name="bind" id="@cdklabs/cdk-appflow.Task.bind"></a>

```typescript
public bind(_flow: IFlow, source: ISource): TaskProperty
```

###### `_flow`<sup>Required</sup> <a name="_flow" id="@cdklabs/cdk-appflow.Task.bind.parameter._flow"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

---

###### `source`<sup>Required</sup> <a name="source" id="@cdklabs/cdk-appflow.Task.bind.parameter.source"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.ISource">ISource</a>

---




### Transform <a name="Transform" id="@cdklabs/cdk-appflow.Transform"></a>

- *Implements:* <a href="#@cdklabs/cdk-appflow.ITransform">ITransform</a>

A representation of a transform operation, that is an operation modifying source fields.

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.Transform.Initializer"></a>

```typescript
import { Transform } from '@cdklabs/cdk-appflow'

new Transform(tasks: ITask[])
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.Transform.Initializer.parameter.tasks">tasks</a></code> | <code><a href="#@cdklabs/cdk-appflow.ITask">ITask</a>[]</code> | *No description.* |

---

##### `tasks`<sup>Required</sup> <a name="tasks" id="@cdklabs/cdk-appflow.Transform.Initializer.parameter.tasks"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.ITask">ITask</a>[]

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.Transform.bind">bind</a></code> | *No description.* |

---

##### `bind` <a name="bind" id="@cdklabs/cdk-appflow.Transform.bind"></a>

```typescript
public bind(flow: IFlow, source: ISource): TaskProperty[]
```

###### `flow`<sup>Required</sup> <a name="flow" id="@cdklabs/cdk-appflow.Transform.bind.parameter.flow"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

---

###### `source`<sup>Required</sup> <a name="source" id="@cdklabs/cdk-appflow.Transform.bind.parameter.source"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.ISource">ISource</a>

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.Transform.mask">mask</a></code> | Masks the field with a specified mask. |
| <code><a href="#@cdklabs/cdk-appflow.Transform.maskEnd">maskEnd</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.Transform.maskStart">maskStart</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.Transform.truncate">truncate</a></code> | Truncates the field to a specified length. |

---

##### `mask` <a name="mask" id="@cdklabs/cdk-appflow.Transform.mask"></a>

```typescript
import { Transform } from '@cdklabs/cdk-appflow'

Transform.mask(field: string | Field, mask?: string)
```

Masks the field with a specified mask.

> [Transform instance](Transform instance)

###### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.Transform.mask.parameter.field"></a>

- *Type:* string | <a href="#@cdklabs/cdk-appflow.Field">Field</a>

a source field to mask.

---

###### `mask`<sup>Optional</sup> <a name="mask" id="@cdklabs/cdk-appflow.Transform.mask.parameter.mask"></a>

- *Type:* string

a mask character.

---

##### `maskEnd` <a name="maskEnd" id="@cdklabs/cdk-appflow.Transform.maskEnd"></a>

```typescript
import { Transform } from '@cdklabs/cdk-appflow'

Transform.maskEnd(field: string | Field, length: number, mask?: string)
```

###### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.Transform.maskEnd.parameter.field"></a>

- *Type:* string | <a href="#@cdklabs/cdk-appflow.Field">Field</a>

---

###### `length`<sup>Required</sup> <a name="length" id="@cdklabs/cdk-appflow.Transform.maskEnd.parameter.length"></a>

- *Type:* number

---

###### `mask`<sup>Optional</sup> <a name="mask" id="@cdklabs/cdk-appflow.Transform.maskEnd.parameter.mask"></a>

- *Type:* string

---

##### `maskStart` <a name="maskStart" id="@cdklabs/cdk-appflow.Transform.maskStart"></a>

```typescript
import { Transform } from '@cdklabs/cdk-appflow'

Transform.maskStart(field: string | Field, length: number, mask?: string)
```

###### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.Transform.maskStart.parameter.field"></a>

- *Type:* string | <a href="#@cdklabs/cdk-appflow.Field">Field</a>

---

###### `length`<sup>Required</sup> <a name="length" id="@cdklabs/cdk-appflow.Transform.maskStart.parameter.length"></a>

- *Type:* number

---

###### `mask`<sup>Optional</sup> <a name="mask" id="@cdklabs/cdk-appflow.Transform.maskStart.parameter.mask"></a>

- *Type:* string

---

##### `truncate` <a name="truncate" id="@cdklabs/cdk-appflow.Transform.truncate"></a>

```typescript
import { Transform } from '@cdklabs/cdk-appflow'

Transform.truncate(field: string | Field, length: number)
```

Truncates the field to a specified length.

> [Transform instance](Transform instance)

###### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.Transform.truncate.parameter.field"></a>

- *Type:* string | <a href="#@cdklabs/cdk-appflow.Field">Field</a>

a source field to truncate.

---

###### `length`<sup>Required</sup> <a name="length" id="@cdklabs/cdk-appflow.Transform.truncate.parameter.length"></a>

- *Type:* number

the maximum length after truncation.

---



### Validation <a name="Validation" id="@cdklabs/cdk-appflow.Validation"></a>

- *Implements:* <a href="#@cdklabs/cdk-appflow.IValidation">IValidation</a>

A representation of a validation operation, that is an operation testing records and acting on the test results.

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.Validation.Initializer"></a>

```typescript
import { Validation } from '@cdklabs/cdk-appflow'

new Validation(condition: ValidationCondition, action: ValidationAction)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.Validation.Initializer.parameter.condition">condition</a></code> | <code><a href="#@cdklabs/cdk-appflow.ValidationCondition">ValidationCondition</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.Validation.Initializer.parameter.action">action</a></code> | <code><a href="#@cdklabs/cdk-appflow.ValidationAction">ValidationAction</a></code> | *No description.* |

---

##### `condition`<sup>Required</sup> <a name="condition" id="@cdklabs/cdk-appflow.Validation.Initializer.parameter.condition"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.ValidationCondition">ValidationCondition</a>

---

##### `action`<sup>Required</sup> <a name="action" id="@cdklabs/cdk-appflow.Validation.Initializer.parameter.action"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.ValidationAction">ValidationAction</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.Validation.bind">bind</a></code> | *No description.* |

---

##### `bind` <a name="bind" id="@cdklabs/cdk-appflow.Validation.bind"></a>

```typescript
public bind(flow: IFlow, source: ISource): TaskProperty[]
```

###### `flow`<sup>Required</sup> <a name="flow" id="@cdklabs/cdk-appflow.Validation.bind.parameter.flow"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

---

###### `source`<sup>Required</sup> <a name="source" id="@cdklabs/cdk-appflow.Validation.bind.parameter.source"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.ISource">ISource</a>

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.Validation.when">when</a></code> | *No description.* |

---

##### `when` <a name="when" id="@cdklabs/cdk-appflow.Validation.when"></a>

```typescript
import { Validation } from '@cdklabs/cdk-appflow'

Validation.when(condition: ValidationCondition, action: ValidationAction)
```

> [ValidationAction for the validation](ValidationAction for the validation)

###### `condition`<sup>Required</sup> <a name="condition" id="@cdklabs/cdk-appflow.Validation.when.parameter.condition"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.ValidationCondition">ValidationCondition</a>

a.

---

###### `action`<sup>Required</sup> <a name="action" id="@cdklabs/cdk-appflow.Validation.when.parameter.action"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.ValidationAction">ValidationAction</a>

a.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.Validation.property.action">action</a></code> | <code><a href="#@cdklabs/cdk-appflow.ValidationAction">ValidationAction</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.Validation.property.condition">condition</a></code> | <code><a href="#@cdklabs/cdk-appflow.ValidationCondition">ValidationCondition</a></code> | *No description.* |

---

##### `action`<sup>Required</sup> <a name="action" id="@cdklabs/cdk-appflow.Validation.property.action"></a>

```typescript
public readonly action: ValidationAction;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ValidationAction">ValidationAction</a>

---

##### `condition`<sup>Required</sup> <a name="condition" id="@cdklabs/cdk-appflow.Validation.property.condition"></a>

```typescript
public readonly condition: ValidationCondition;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ValidationCondition">ValidationCondition</a>

---


### ValidationAction <a name="ValidationAction" id="@cdklabs/cdk-appflow.ValidationAction"></a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.ValidationAction.Initializer"></a>

```typescript
import { ValidationAction } from '@cdklabs/cdk-appflow'

new ValidationAction(action: string)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ValidationAction.Initializer.parameter.action">action</a></code> | <code>string</code> | *No description.* |

---

##### `action`<sup>Required</sup> <a name="action" id="@cdklabs/cdk-appflow.ValidationAction.Initializer.parameter.action"></a>

- *Type:* string

---


#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ValidationAction.ignoreRecord">ignoreRecord</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ValidationAction.terminateFlow">terminateFlow</a></code> | *No description.* |

---

##### `ignoreRecord` <a name="ignoreRecord" id="@cdklabs/cdk-appflow.ValidationAction.ignoreRecord"></a>

```typescript
import { ValidationAction } from '@cdklabs/cdk-appflow'

ValidationAction.ignoreRecord()
```

> [ValidationAction that removes a record from the flow execution result](ValidationAction that removes a record from the flow execution result)

##### `terminateFlow` <a name="terminateFlow" id="@cdklabs/cdk-appflow.ValidationAction.terminateFlow"></a>

```typescript
import { ValidationAction } from '@cdklabs/cdk-appflow'

ValidationAction.terminateFlow()
```

> [ValidationAction that terminates the whole flow execution](ValidationAction that terminates the whole flow execution)

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ValidationAction.property.action">action</a></code> | <code>string</code> | *No description.* |

---

##### `action`<sup>Required</sup> <a name="action" id="@cdklabs/cdk-appflow.ValidationAction.property.action"></a>

```typescript
public readonly action: string;
```

- *Type:* string

---


### ValidationCondition <a name="ValidationCondition" id="@cdklabs/cdk-appflow.ValidationCondition"></a>

A representation of a validation condition on a particular field in a flow execution.

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.ValidationCondition.Initializer"></a>

```typescript
import { ValidationCondition } from '@cdklabs/cdk-appflow'

new ValidationCondition(field: string, validation: string)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ValidationCondition.Initializer.parameter.field">field</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ValidationCondition.Initializer.parameter.validation">validation</a></code> | <code>string</code> | *No description.* |

---

##### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.ValidationCondition.Initializer.parameter.field"></a>

- *Type:* string

---

##### `validation`<sup>Required</sup> <a name="validation" id="@cdklabs/cdk-appflow.ValidationCondition.Initializer.parameter.validation"></a>

- *Type:* string

---


#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ValidationCondition.isDefault">isDefault</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ValidationCondition.isNegative">isNegative</a></code> | Validates whether a particular field in an execution is negative. |
| <code><a href="#@cdklabs/cdk-appflow.ValidationCondition.isNotNull">isNotNull</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ValidationCondition.isNull">isNull</a></code> | Validates whether a particular field has no value. |

---

##### `isDefault` <a name="isDefault" id="@cdklabs/cdk-appflow.ValidationCondition.isDefault"></a>

```typescript
import { ValidationCondition } from '@cdklabs/cdk-appflow'

ValidationCondition.isDefault(field: string | Field)
```

> [ValidationCondition instance](ValidationCondition instance)

###### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.ValidationCondition.isDefault.parameter.field"></a>

- *Type:* string | <a href="#@cdklabs/cdk-appflow.Field">Field</a>

a field for which the validation will be performed.

---

##### `isNegative` <a name="isNegative" id="@cdklabs/cdk-appflow.ValidationCondition.isNegative"></a>

```typescript
import { ValidationCondition } from '@cdklabs/cdk-appflow'

ValidationCondition.isNegative(field: string | Field)
```

Validates whether a particular field in an execution is negative.

> [ValidationCondition instance](ValidationCondition instance)

###### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.ValidationCondition.isNegative.parameter.field"></a>

- *Type:* string | <a href="#@cdklabs/cdk-appflow.Field">Field</a>

a field for which the validation will be performed.

---

##### `isNotNull` <a name="isNotNull" id="@cdklabs/cdk-appflow.ValidationCondition.isNotNull"></a>

```typescript
import { ValidationCondition } from '@cdklabs/cdk-appflow'

ValidationCondition.isNotNull(field: string | Field)
```

> [ValidationCondition instance](ValidationCondition instance)

###### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.ValidationCondition.isNotNull.parameter.field"></a>

- *Type:* string | <a href="#@cdklabs/cdk-appflow.Field">Field</a>

a field for which the validation will be performed.

---

##### `isNull` <a name="isNull" id="@cdklabs/cdk-appflow.ValidationCondition.isNull"></a>

```typescript
import { ValidationCondition } from '@cdklabs/cdk-appflow'

ValidationCondition.isNull(field: string | Field)
```

Validates whether a particular field has no value.

> [ValidationCondition instance](ValidationCondition instance)

###### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.ValidationCondition.isNull.parameter.field"></a>

- *Type:* string | <a href="#@cdklabs/cdk-appflow.Field">Field</a>

a field for which the validation will be performed.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ValidationCondition.property.field">field</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ValidationCondition.property.validation">validation</a></code> | <code>string</code> | *No description.* |

---

##### `field`<sup>Required</sup> <a name="field" id="@cdklabs/cdk-appflow.ValidationCondition.property.field"></a>

```typescript
public readonly field: string;
```

- *Type:* string

---

##### `validation`<sup>Required</sup> <a name="validation" id="@cdklabs/cdk-appflow.ValidationCondition.property.validation"></a>

```typescript
public readonly validation: string;
```

- *Type:* string

---


### WriteOperation <a name="WriteOperation" id="@cdklabs/cdk-appflow.WriteOperation"></a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.WriteOperation.Initializer"></a>

```typescript
import { WriteOperation } from '@cdklabs/cdk-appflow'

new WriteOperation(type: WriteOperationType, ids?: string[])
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.WriteOperation.Initializer.parameter.type">type</a></code> | <code><a href="#@cdklabs/cdk-appflow.WriteOperationType">WriteOperationType</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.WriteOperation.Initializer.parameter.ids">ids</a></code> | <code>string[]</code> | *No description.* |

---

##### `type`<sup>Required</sup> <a name="type" id="@cdklabs/cdk-appflow.WriteOperation.Initializer.parameter.type"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.WriteOperationType">WriteOperationType</a>

---

##### `ids`<sup>Optional</sup> <a name="ids" id="@cdklabs/cdk-appflow.WriteOperation.Initializer.parameter.ids"></a>

- *Type:* string[]

---


#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.WriteOperation.delete">delete</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.WriteOperation.insert">insert</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.WriteOperation.update">update</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.WriteOperation.upsert">upsert</a></code> | *No description.* |

---

##### `delete` <a name="delete" id="@cdklabs/cdk-appflow.WriteOperation.delete"></a>

```typescript
import { WriteOperation } from '@cdklabs/cdk-appflow'

WriteOperation.delete(ids?: string[])
```

###### `ids`<sup>Optional</sup> <a name="ids" id="@cdklabs/cdk-appflow.WriteOperation.delete.parameter.ids"></a>

- *Type:* string[]

---

##### `insert` <a name="insert" id="@cdklabs/cdk-appflow.WriteOperation.insert"></a>

```typescript
import { WriteOperation } from '@cdklabs/cdk-appflow'

WriteOperation.insert(ids?: string[])
```

###### `ids`<sup>Optional</sup> <a name="ids" id="@cdklabs/cdk-appflow.WriteOperation.insert.parameter.ids"></a>

- *Type:* string[]

---

##### `update` <a name="update" id="@cdklabs/cdk-appflow.WriteOperation.update"></a>

```typescript
import { WriteOperation } from '@cdklabs/cdk-appflow'

WriteOperation.update(ids?: string[])
```

###### `ids`<sup>Optional</sup> <a name="ids" id="@cdklabs/cdk-appflow.WriteOperation.update.parameter.ids"></a>

- *Type:* string[]

---

##### `upsert` <a name="upsert" id="@cdklabs/cdk-appflow.WriteOperation.upsert"></a>

```typescript
import { WriteOperation } from '@cdklabs/cdk-appflow'

WriteOperation.upsert(ids?: string[])
```

###### `ids`<sup>Optional</sup> <a name="ids" id="@cdklabs/cdk-appflow.WriteOperation.upsert.parameter.ids"></a>

- *Type:* string[]

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.WriteOperation.property.type">type</a></code> | <code><a href="#@cdklabs/cdk-appflow.WriteOperationType">WriteOperationType</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.WriteOperation.property.ids">ids</a></code> | <code>string[]</code> | *No description.* |

---

##### `type`<sup>Required</sup> <a name="type" id="@cdklabs/cdk-appflow.WriteOperation.property.type"></a>

```typescript
public readonly type: WriteOperationType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.WriteOperationType">WriteOperationType</a>

---

##### `ids`<sup>Optional</sup> <a name="ids" id="@cdklabs/cdk-appflow.WriteOperation.property.ids"></a>

```typescript
public readonly ids: string[];
```

- *Type:* string[]

---


### ZendeskInstanceUrlBuilder <a name="ZendeskInstanceUrlBuilder" id="@cdklabs/cdk-appflow.ZendeskInstanceUrlBuilder"></a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.ZendeskInstanceUrlBuilder.Initializer"></a>

```typescript
import { ZendeskInstanceUrlBuilder } from '@cdklabs/cdk-appflow'

new ZendeskInstanceUrlBuilder()
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |

---


#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskInstanceUrlBuilder.buildFromAccount">buildFromAccount</a></code> | *No description.* |

---

##### `buildFromAccount` <a name="buildFromAccount" id="@cdklabs/cdk-appflow.ZendeskInstanceUrlBuilder.buildFromAccount"></a>

```typescript
import { ZendeskInstanceUrlBuilder } from '@cdklabs/cdk-appflow'

ZendeskInstanceUrlBuilder.buildFromAccount(account: string)
```

###### `account`<sup>Required</sup> <a name="account" id="@cdklabs/cdk-appflow.ZendeskInstanceUrlBuilder.buildFromAccount.parameter.account"></a>

- *Type:* string

---



### ZendeskSource <a name="ZendeskSource" id="@cdklabs/cdk-appflow.ZendeskSource"></a>

- *Implements:* <a href="#@cdklabs/cdk-appflow.ISource">ISource</a>

#### Initializers <a name="Initializers" id="@cdklabs/cdk-appflow.ZendeskSource.Initializer"></a>

```typescript
import { ZendeskSource } from '@cdklabs/cdk-appflow'

new ZendeskSource(props: ZendeskSourceProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskSource.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-appflow.ZendeskSourceProps">ZendeskSourceProps</a></code> | *No description.* |

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-appflow.ZendeskSource.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.ZendeskSourceProps">ZendeskSourceProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskSource.bind">bind</a></code> | *No description.* |

---

##### `bind` <a name="bind" id="@cdklabs/cdk-appflow.ZendeskSource.bind"></a>

```typescript
public bind(flow: IFlow): SourceFlowConfigProperty
```

###### `flow`<sup>Required</sup> <a name="flow" id="@cdklabs/cdk-appflow.ZendeskSource.bind.parameter.flow"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

---


#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ZendeskSource.property.connectorType">connectorType</a></code> | <code><a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a></code> | The AppFlow type of the connector that this source is implemented for. |

---

##### `connectorType`<sup>Required</sup> <a name="connectorType" id="@cdklabs/cdk-appflow.ZendeskSource.property.connectorType"></a>

```typescript
public readonly connectorType: ConnectorType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a>

The AppFlow type of the connector that this source is implemented for.

---


## Protocols <a name="Protocols" id="Protocols"></a>

### IConnectorProfile <a name="IConnectorProfile" id="@cdklabs/cdk-appflow.IConnectorProfile"></a>

- *Extends:* aws-cdk-lib.IResource

- *Implemented By:* <a href="#@cdklabs/cdk-appflow.ConnectorProfileBase">ConnectorProfileBase</a>, <a href="#@cdklabs/cdk-appflow.GoogleAnalytics4ConnectorProfile">GoogleAnalytics4ConnectorProfile</a>, <a href="#@cdklabs/cdk-appflow.MarketoConnectorProfile">MarketoConnectorProfile</a>, <a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineConnectorProfile">MicrosoftSharepointOnlineConnectorProfile</a>, <a href="#@cdklabs/cdk-appflow.RedshiftConnectorProfile">RedshiftConnectorProfile</a>, <a href="#@cdklabs/cdk-appflow.SAPOdataConnectorProfile">SAPOdataConnectorProfile</a>, <a href="#@cdklabs/cdk-appflow.SalesforceConnectorProfile">SalesforceConnectorProfile</a>, <a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudConnectorProfile">SalesforceMarketingCloudConnectorProfile</a>, <a href="#@cdklabs/cdk-appflow.ServiceNowConnectorProfile">ServiceNowConnectorProfile</a>, <a href="#@cdklabs/cdk-appflow.SlackConnectorProfile">SlackConnectorProfile</a>, <a href="#@cdklabs/cdk-appflow.ZendeskConnectorProfile">ZendeskConnectorProfile</a>, <a href="#@cdklabs/cdk-appflow.IConnectorProfile">IConnectorProfile</a>


#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.IConnectorProfile.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@cdklabs/cdk-appflow.IConnectorProfile.property.env">env</a></code> | <code>aws-cdk-lib.ResourceEnvironment</code> | The environment this resource belongs to. |
| <code><a href="#@cdklabs/cdk-appflow.IConnectorProfile.property.stack">stack</a></code> | <code>aws-cdk-lib.Stack</code> | The stack in which this resource is defined. |
| <code><a href="#@cdklabs/cdk-appflow.IConnectorProfile.property.arn">arn</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.IConnectorProfile.property.name">name</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.IConnectorProfile.property.credentials">credentials</a></code> | <code>aws-cdk-lib.aws_secretsmanager.ISecret</code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-appflow.IConnectorProfile.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `env`<sup>Required</sup> <a name="env" id="@cdklabs/cdk-appflow.IConnectorProfile.property.env"></a>

```typescript
public readonly env: ResourceEnvironment;
```

- *Type:* aws-cdk-lib.ResourceEnvironment

The environment this resource belongs to.

For resources that are created and managed by the CDK
(generally, those created by creating new class instances like Role, Bucket, etc.),
this is always the same as the environment of the stack they belong to;
however, for imported resources
(those obtained from static methods like fromRoleArn, fromBucketName, etc.),
that might be different than the stack they were imported into.

---

##### `stack`<sup>Required</sup> <a name="stack" id="@cdklabs/cdk-appflow.IConnectorProfile.property.stack"></a>

```typescript
public readonly stack: Stack;
```

- *Type:* aws-cdk-lib.Stack

The stack in which this resource is defined.

---

##### `arn`<sup>Required</sup> <a name="arn" id="@cdklabs/cdk-appflow.IConnectorProfile.property.arn"></a>

```typescript
public readonly arn: string;
```

- *Type:* string

---

##### `name`<sup>Required</sup> <a name="name" id="@cdklabs/cdk-appflow.IConnectorProfile.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

---

##### `credentials`<sup>Optional</sup> <a name="credentials" id="@cdklabs/cdk-appflow.IConnectorProfile.property.credentials"></a>

```typescript
public readonly credentials: ISecret;
```

- *Type:* aws-cdk-lib.aws_secretsmanager.ISecret

---

### IDestination <a name="IDestination" id="@cdklabs/cdk-appflow.IDestination"></a>

- *Extends:* <a href="#@cdklabs/cdk-appflow.IVertex">IVertex</a>

- *Implemented By:* <a href="#@cdklabs/cdk-appflow.EventBridgeDestination">EventBridgeDestination</a>, <a href="#@cdklabs/cdk-appflow.RedshiftDestination">RedshiftDestination</a>, <a href="#@cdklabs/cdk-appflow.S3Destination">S3Destination</a>, <a href="#@cdklabs/cdk-appflow.SAPOdataDestination">SAPOdataDestination</a>, <a href="#@cdklabs/cdk-appflow.SalesforceDestination">SalesforceDestination</a>, <a href="#@cdklabs/cdk-appflow.IDestination">IDestination</a>

A destination of an AppFlow flow.

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.IDestination.bind">bind</a></code> | *No description.* |

---

##### `bind` <a name="bind" id="@cdklabs/cdk-appflow.IDestination.bind"></a>

```typescript
public bind(scope: IFlow): DestinationFlowConfigProperty
```

###### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.IDestination.bind.parameter.scope"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.IDestination.property.connectorType">connectorType</a></code> | <code><a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a></code> | The AppFlow type of the connector that this source is implemented for. |

---

##### `connectorType`<sup>Required</sup> <a name="connectorType" id="@cdklabs/cdk-appflow.IDestination.property.connectorType"></a>

```typescript
public readonly connectorType: ConnectorType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a>

The AppFlow type of the connector that this source is implemented for.

---

### IFilter <a name="IFilter" id="@cdklabs/cdk-appflow.IFilter"></a>

- *Extends:* <a href="#@cdklabs/cdk-appflow.IOperation">IOperation</a>

- *Implemented By:* <a href="#@cdklabs/cdk-appflow.Filter">Filter</a>, <a href="#@cdklabs/cdk-appflow.IFilter">IFilter</a>

A representation of a mapping operation, that is an operation filtering records at the source.



### IFlow <a name="IFlow" id="@cdklabs/cdk-appflow.IFlow"></a>

- *Extends:* aws-cdk-lib.IResource

- *Implemented By:* <a href="#@cdklabs/cdk-appflow.FlowBase">FlowBase</a>, <a href="#@cdklabs/cdk-appflow.OnDemandFlow">OnDemandFlow</a>, <a href="#@cdklabs/cdk-appflow.OnEventFlow">OnEventFlow</a>, <a href="#@cdklabs/cdk-appflow.OnScheduleFlow">OnScheduleFlow</a>, <a href="#@cdklabs/cdk-appflow.TriggeredFlowBase">TriggeredFlowBase</a>, <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.IFlow.onRunCompleted">onRunCompleted</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.IFlow.onRunStarted">onRunStarted</a></code> | *No description.* |

---

##### `onRunCompleted` <a name="onRunCompleted" id="@cdklabs/cdk-appflow.IFlow.onRunCompleted"></a>

```typescript
public onRunCompleted(id: string, options?: OnEventOptions): Rule
```

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.IFlow.onRunCompleted.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Optional</sup> <a name="options" id="@cdklabs/cdk-appflow.IFlow.onRunCompleted.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_events.OnEventOptions

---

##### `onRunStarted` <a name="onRunStarted" id="@cdklabs/cdk-appflow.IFlow.onRunStarted"></a>

```typescript
public onRunStarted(id: string, options?: OnEventOptions): Rule
```

###### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-appflow.IFlow.onRunStarted.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Optional</sup> <a name="options" id="@cdklabs/cdk-appflow.IFlow.onRunStarted.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_events.OnEventOptions

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.IFlow.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@cdklabs/cdk-appflow.IFlow.property.env">env</a></code> | <code>aws-cdk-lib.ResourceEnvironment</code> | The environment this resource belongs to. |
| <code><a href="#@cdklabs/cdk-appflow.IFlow.property.stack">stack</a></code> | <code>aws-cdk-lib.Stack</code> | The stack in which this resource is defined. |
| <code><a href="#@cdklabs/cdk-appflow.IFlow.property.arn">arn</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.IFlow.property.type">type</a></code> | <code><a href="#@cdklabs/cdk-appflow.FlowType">FlowType</a></code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-appflow.IFlow.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `env`<sup>Required</sup> <a name="env" id="@cdklabs/cdk-appflow.IFlow.property.env"></a>

```typescript
public readonly env: ResourceEnvironment;
```

- *Type:* aws-cdk-lib.ResourceEnvironment

The environment this resource belongs to.

For resources that are created and managed by the CDK
(generally, those created by creating new class instances like Role, Bucket, etc.),
this is always the same as the environment of the stack they belong to;
however, for imported resources
(those obtained from static methods like fromRoleArn, fromBucketName, etc.),
that might be different than the stack they were imported into.

---

##### `stack`<sup>Required</sup> <a name="stack" id="@cdklabs/cdk-appflow.IFlow.property.stack"></a>

```typescript
public readonly stack: Stack;
```

- *Type:* aws-cdk-lib.Stack

The stack in which this resource is defined.

---

##### `arn`<sup>Required</sup> <a name="arn" id="@cdklabs/cdk-appflow.IFlow.property.arn"></a>

```typescript
public readonly arn: string;
```

- *Type:* string

---

##### `type`<sup>Required</sup> <a name="type" id="@cdklabs/cdk-appflow.IFlow.property.type"></a>

```typescript
public readonly type: FlowType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.FlowType">FlowType</a>

---

### IMapping <a name="IMapping" id="@cdklabs/cdk-appflow.IMapping"></a>

- *Extends:* <a href="#@cdklabs/cdk-appflow.IOperation">IOperation</a>

- *Implemented By:* <a href="#@cdklabs/cdk-appflow.Mapping">Mapping</a>, <a href="#@cdklabs/cdk-appflow.IMapping">IMapping</a>

A representation of a mapping operation, that is an operation translating source to destination fields.



### IOperation <a name="IOperation" id="@cdklabs/cdk-appflow.IOperation"></a>

- *Implemented By:* <a href="#@cdklabs/cdk-appflow.Filter">Filter</a>, <a href="#@cdklabs/cdk-appflow.Mapping">Mapping</a>, <a href="#@cdklabs/cdk-appflow.OperationBase">OperationBase</a>, <a href="#@cdklabs/cdk-appflow.Transform">Transform</a>, <a href="#@cdklabs/cdk-appflow.Validation">Validation</a>, <a href="#@cdklabs/cdk-appflow.IFilter">IFilter</a>, <a href="#@cdklabs/cdk-appflow.IMapping">IMapping</a>, <a href="#@cdklabs/cdk-appflow.IOperation">IOperation</a>, <a href="#@cdklabs/cdk-appflow.ITransform">ITransform</a>, <a href="#@cdklabs/cdk-appflow.IValidation">IValidation</a>

A representation of a set of tasks that deliver complete operation.

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.IOperation.bind">bind</a></code> | *No description.* |

---

##### `bind` <a name="bind" id="@cdklabs/cdk-appflow.IOperation.bind"></a>

```typescript
public bind(flow: IFlow, source: ISource): TaskProperty[]
```

###### `flow`<sup>Required</sup> <a name="flow" id="@cdklabs/cdk-appflow.IOperation.bind.parameter.flow"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

---

###### `source`<sup>Required</sup> <a name="source" id="@cdklabs/cdk-appflow.IOperation.bind.parameter.source"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.ISource">ISource</a>

---


### ISource <a name="ISource" id="@cdklabs/cdk-appflow.ISource"></a>

- *Extends:* <a href="#@cdklabs/cdk-appflow.IVertex">IVertex</a>

- *Implemented By:* <a href="#@cdklabs/cdk-appflow.GoogleAnalytics4Source">GoogleAnalytics4Source</a>, <a href="#@cdklabs/cdk-appflow.MarketoSource">MarketoSource</a>, <a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineSource">MicrosoftSharepointOnlineSource</a>, <a href="#@cdklabs/cdk-appflow.S3Source">S3Source</a>, <a href="#@cdklabs/cdk-appflow.SAPOdataSource">SAPOdataSource</a>, <a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudSource">SalesforceMarketingCloudSource</a>, <a href="#@cdklabs/cdk-appflow.SalesforceSource">SalesforceSource</a>, <a href="#@cdklabs/cdk-appflow.ServiceNowSource">ServiceNowSource</a>, <a href="#@cdklabs/cdk-appflow.SlackSource">SlackSource</a>, <a href="#@cdklabs/cdk-appflow.ZendeskSource">ZendeskSource</a>, <a href="#@cdklabs/cdk-appflow.ISource">ISource</a>

A source of an AppFlow flow.

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ISource.bind">bind</a></code> | *No description.* |

---

##### `bind` <a name="bind" id="@cdklabs/cdk-appflow.ISource.bind"></a>

```typescript
public bind(scope: IFlow): SourceFlowConfigProperty
```

###### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-appflow.ISource.bind.parameter.scope"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ISource.property.connectorType">connectorType</a></code> | <code><a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a></code> | The AppFlow type of the connector that this source is implemented for. |

---

##### `connectorType`<sup>Required</sup> <a name="connectorType" id="@cdklabs/cdk-appflow.ISource.property.connectorType"></a>

```typescript
public readonly connectorType: ConnectorType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a>

The AppFlow type of the connector that this source is implemented for.

---

### ITask <a name="ITask" id="@cdklabs/cdk-appflow.ITask"></a>

- *Implemented By:* <a href="#@cdklabs/cdk-appflow.Task">Task</a>, <a href="#@cdklabs/cdk-appflow.ITask">ITask</a>

A representation of a unitary action on the record fields.

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ITask.bind">bind</a></code> | *No description.* |

---

##### `bind` <a name="bind" id="@cdklabs/cdk-appflow.ITask.bind"></a>

```typescript
public bind(flow: IFlow, source: ISource): TaskProperty
```

###### `flow`<sup>Required</sup> <a name="flow" id="@cdklabs/cdk-appflow.ITask.bind.parameter.flow"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.IFlow">IFlow</a>

---

###### `source`<sup>Required</sup> <a name="source" id="@cdklabs/cdk-appflow.ITask.bind.parameter.source"></a>

- *Type:* <a href="#@cdklabs/cdk-appflow.ISource">ISource</a>

---


### ITransform <a name="ITransform" id="@cdklabs/cdk-appflow.ITransform"></a>

- *Extends:* <a href="#@cdklabs/cdk-appflow.IOperation">IOperation</a>

- *Implemented By:* <a href="#@cdklabs/cdk-appflow.Transform">Transform</a>, <a href="#@cdklabs/cdk-appflow.ITransform">ITransform</a>

A representation of a transform operation, that is an operation modifying source fields.



### IValidation <a name="IValidation" id="@cdklabs/cdk-appflow.IValidation"></a>

- *Extends:* <a href="#@cdklabs/cdk-appflow.IOperation">IOperation</a>

- *Implemented By:* <a href="#@cdklabs/cdk-appflow.Validation">Validation</a>, <a href="#@cdklabs/cdk-appflow.IValidation">IValidation</a>

A representation of a validation operation, that is an operation testing records and acting on the test results.



### IVertex <a name="IVertex" id="@cdklabs/cdk-appflow.IVertex"></a>

- *Implemented By:* <a href="#@cdklabs/cdk-appflow.EventBridgeDestination">EventBridgeDestination</a>, <a href="#@cdklabs/cdk-appflow.GoogleAnalytics4Source">GoogleAnalytics4Source</a>, <a href="#@cdklabs/cdk-appflow.MarketoSource">MarketoSource</a>, <a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineSource">MicrosoftSharepointOnlineSource</a>, <a href="#@cdklabs/cdk-appflow.RedshiftDestination">RedshiftDestination</a>, <a href="#@cdklabs/cdk-appflow.S3Destination">S3Destination</a>, <a href="#@cdklabs/cdk-appflow.S3Source">S3Source</a>, <a href="#@cdklabs/cdk-appflow.SAPOdataDestination">SAPOdataDestination</a>, <a href="#@cdklabs/cdk-appflow.SAPOdataSource">SAPOdataSource</a>, <a href="#@cdklabs/cdk-appflow.SalesforceDestination">SalesforceDestination</a>, <a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudSource">SalesforceMarketingCloudSource</a>, <a href="#@cdklabs/cdk-appflow.SalesforceSource">SalesforceSource</a>, <a href="#@cdklabs/cdk-appflow.ServiceNowSource">ServiceNowSource</a>, <a href="#@cdklabs/cdk-appflow.SlackSource">SlackSource</a>, <a href="#@cdklabs/cdk-appflow.ZendeskSource">ZendeskSource</a>, <a href="#@cdklabs/cdk-appflow.IDestination">IDestination</a>, <a href="#@cdklabs/cdk-appflow.ISource">ISource</a>, <a href="#@cdklabs/cdk-appflow.IVertex">IVertex</a>

An interface representing a vertex, i.e. a source or a destination of an AppFlow flow.


#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.IVertex.property.connectorType">connectorType</a></code> | <code><a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a></code> | The AppFlow type of the connector that this source is implemented for. |

---

##### `connectorType`<sup>Required</sup> <a name="connectorType" id="@cdklabs/cdk-appflow.IVertex.property.connectorType"></a>

```typescript
public readonly connectorType: ConnectorType;
```

- *Type:* <a href="#@cdklabs/cdk-appflow.ConnectorType">ConnectorType</a>

The AppFlow type of the connector that this source is implemented for.

---

## Enums <a name="Enums" id="Enums"></a>

### ConnectionMode <a name="ConnectionMode" id="@cdklabs/cdk-appflow.ConnectionMode"></a>

#### Members <a name="Members" id="Members"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ConnectionMode.PUBLIC">PUBLIC</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ConnectionMode.PRIVATE">PRIVATE</a></code> | *No description.* |

---

##### `PUBLIC` <a name="PUBLIC" id="@cdklabs/cdk-appflow.ConnectionMode.PUBLIC"></a>

---


##### `PRIVATE` <a name="PRIVATE" id="@cdklabs/cdk-appflow.ConnectionMode.PRIVATE"></a>

---


### ConnectorAuthenticationType <a name="ConnectorAuthenticationType" id="@cdklabs/cdk-appflow.ConnectorAuthenticationType"></a>

#### Members <a name="Members" id="Members"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.ConnectorAuthenticationType.APIKEY">APIKEY</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ConnectorAuthenticationType.BASIC">BASIC</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ConnectorAuthenticationType.CUSTOM">CUSTOM</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.ConnectorAuthenticationType.OAUTH2">OAUTH2</a></code> | *No description.* |

---

##### `APIKEY` <a name="APIKEY" id="@cdklabs/cdk-appflow.ConnectorAuthenticationType.APIKEY"></a>

---


##### `BASIC` <a name="BASIC" id="@cdklabs/cdk-appflow.ConnectorAuthenticationType.BASIC"></a>

---


##### `CUSTOM` <a name="CUSTOM" id="@cdklabs/cdk-appflow.ConnectorAuthenticationType.CUSTOM"></a>

---


##### `OAUTH2` <a name="OAUTH2" id="@cdklabs/cdk-appflow.ConnectorAuthenticationType.OAUTH2"></a>

---


### DataPullMode <a name="DataPullMode" id="@cdklabs/cdk-appflow.DataPullMode"></a>

#### Members <a name="Members" id="Members"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.DataPullMode.COMPLETE">COMPLETE</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.DataPullMode.INCREMENTAL">INCREMENTAL</a></code> | *No description.* |

---

##### `COMPLETE` <a name="COMPLETE" id="@cdklabs/cdk-appflow.DataPullMode.COMPLETE"></a>

---


##### `INCREMENTAL` <a name="INCREMENTAL" id="@cdklabs/cdk-appflow.DataPullMode.INCREMENTAL"></a>

---


### FlowType <a name="FlowType" id="@cdklabs/cdk-appflow.FlowType"></a>

#### Members <a name="Members" id="Members"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.FlowType.EVENT">EVENT</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FlowType.ON_DEMAND">ON_DEMAND</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.FlowType.SCHEDULED">SCHEDULED</a></code> | *No description.* |

---

##### `EVENT` <a name="EVENT" id="@cdklabs/cdk-appflow.FlowType.EVENT"></a>

---


##### `ON_DEMAND` <a name="ON_DEMAND" id="@cdklabs/cdk-appflow.FlowType.ON_DEMAND"></a>

---


##### `SCHEDULED` <a name="SCHEDULED" id="@cdklabs/cdk-appflow.FlowType.SCHEDULED"></a>

---


### GoogleAnalytics4ApiVersion <a name="GoogleAnalytics4ApiVersion" id="@cdklabs/cdk-appflow.GoogleAnalytics4ApiVersion"></a>

#### Members <a name="Members" id="Members"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.GoogleAnalytics4ApiVersion.V1BETA">V1BETA</a></code> | *No description.* |

---

##### `V1BETA` <a name="V1BETA" id="@cdklabs/cdk-appflow.GoogleAnalytics4ApiVersion.V1BETA"></a>

---


### MicrosoftSharepointOnlineApiVersion <a name="MicrosoftSharepointOnlineApiVersion" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineApiVersion"></a>

#### Members <a name="Members" id="Members"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.MicrosoftSharepointOnlineApiVersion.V1">V1</a></code> | *No description.* |

---

##### `V1` <a name="V1" id="@cdklabs/cdk-appflow.MicrosoftSharepointOnlineApiVersion.V1"></a>

---


### OAuth2GrantType <a name="OAuth2GrantType" id="@cdklabs/cdk-appflow.OAuth2GrantType"></a>

#### Members <a name="Members" id="Members"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.OAuth2GrantType.CLIENT_CREDENTIALS">CLIENT_CREDENTIALS</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.OAuth2GrantType.AUTHORIZATION_CODE">AUTHORIZATION_CODE</a></code> | *No description.* |

---

##### `CLIENT_CREDENTIALS` <a name="CLIENT_CREDENTIALS" id="@cdklabs/cdk-appflow.OAuth2GrantType.CLIENT_CREDENTIALS"></a>

---


##### `AUTHORIZATION_CODE` <a name="AUTHORIZATION_CODE" id="@cdklabs/cdk-appflow.OAuth2GrantType.AUTHORIZATION_CODE"></a>

---


### S3InputFileType <a name="S3InputFileType" id="@cdklabs/cdk-appflow.S3InputFileType"></a>

The file type that Amazon AppFlow gets from your Amazon S3 bucket.

#### Members <a name="Members" id="Members"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.S3InputFileType.CSV">CSV</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.S3InputFileType.JSON">JSON</a></code> | *No description.* |

---

##### `CSV` <a name="CSV" id="@cdklabs/cdk-appflow.S3InputFileType.CSV"></a>

---


##### `JSON` <a name="JSON" id="@cdklabs/cdk-appflow.S3InputFileType.JSON"></a>

---


### S3OutputAggregationType <a name="S3OutputAggregationType" id="@cdklabs/cdk-appflow.S3OutputAggregationType"></a>

#### Members <a name="Members" id="Members"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.S3OutputAggregationType.NONE">NONE</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.S3OutputAggregationType.SINGLE_FILE">SINGLE_FILE</a></code> | *No description.* |

---

##### `NONE` <a name="NONE" id="@cdklabs/cdk-appflow.S3OutputAggregationType.NONE"></a>

---


##### `SINGLE_FILE` <a name="SINGLE_FILE" id="@cdklabs/cdk-appflow.S3OutputAggregationType.SINGLE_FILE"></a>

---


### S3OutputFilePrefixFormat <a name="S3OutputFilePrefixFormat" id="@cdklabs/cdk-appflow.S3OutputFilePrefixFormat"></a>

#### Members <a name="Members" id="Members"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.S3OutputFilePrefixFormat.DAY">DAY</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.S3OutputFilePrefixFormat.HOUR">HOUR</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.S3OutputFilePrefixFormat.MINUTE">MINUTE</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.S3OutputFilePrefixFormat.MONTH">MONTH</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.S3OutputFilePrefixFormat.YEAR">YEAR</a></code> | *No description.* |

---

##### `DAY` <a name="DAY" id="@cdklabs/cdk-appflow.S3OutputFilePrefixFormat.DAY"></a>

---


##### `HOUR` <a name="HOUR" id="@cdklabs/cdk-appflow.S3OutputFilePrefixFormat.HOUR"></a>

---


##### `MINUTE` <a name="MINUTE" id="@cdklabs/cdk-appflow.S3OutputFilePrefixFormat.MINUTE"></a>

---


##### `MONTH` <a name="MONTH" id="@cdklabs/cdk-appflow.S3OutputFilePrefixFormat.MONTH"></a>

---


##### `YEAR` <a name="YEAR" id="@cdklabs/cdk-appflow.S3OutputFilePrefixFormat.YEAR"></a>

---


### S3OutputFilePrefixHierarchy <a name="S3OutputFilePrefixHierarchy" id="@cdklabs/cdk-appflow.S3OutputFilePrefixHierarchy"></a>

#### Members <a name="Members" id="Members"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.S3OutputFilePrefixHierarchy.EXECUTION_ID">EXECUTION_ID</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.S3OutputFilePrefixHierarchy.SCHEMA_VERSION">SCHEMA_VERSION</a></code> | *No description.* |

---

##### `EXECUTION_ID` <a name="EXECUTION_ID" id="@cdklabs/cdk-appflow.S3OutputFilePrefixHierarchy.EXECUTION_ID"></a>

---


##### `SCHEMA_VERSION` <a name="SCHEMA_VERSION" id="@cdklabs/cdk-appflow.S3OutputFilePrefixHierarchy.SCHEMA_VERSION"></a>

---


### S3OutputFilePrefixType <a name="S3OutputFilePrefixType" id="@cdklabs/cdk-appflow.S3OutputFilePrefixType"></a>

#### Members <a name="Members" id="Members"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.S3OutputFilePrefixType.FILENAME">FILENAME</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.S3OutputFilePrefixType.PATH">PATH</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.S3OutputFilePrefixType.PATH_AND_FILE">PATH_AND_FILE</a></code> | *No description.* |

---

##### `FILENAME` <a name="FILENAME" id="@cdklabs/cdk-appflow.S3OutputFilePrefixType.FILENAME"></a>

---


##### `PATH` <a name="PATH" id="@cdklabs/cdk-appflow.S3OutputFilePrefixType.PATH"></a>

---


##### `PATH_AND_FILE` <a name="PATH_AND_FILE" id="@cdklabs/cdk-appflow.S3OutputFilePrefixType.PATH_AND_FILE"></a>

---


### S3OutputFileType <a name="S3OutputFileType" id="@cdklabs/cdk-appflow.S3OutputFileType"></a>

#### Members <a name="Members" id="Members"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.S3OutputFileType.CSV">CSV</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.S3OutputFileType.JSON">JSON</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.S3OutputFileType.PARQUET">PARQUET</a></code> | *No description.* |

---

##### `CSV` <a name="CSV" id="@cdklabs/cdk-appflow.S3OutputFileType.CSV"></a>

---


##### `JSON` <a name="JSON" id="@cdklabs/cdk-appflow.S3OutputFileType.JSON"></a>

---


##### `PARQUET` <a name="PARQUET" id="@cdklabs/cdk-appflow.S3OutputFileType.PARQUET"></a>

---


### SalesforceDataTransferApi <a name="SalesforceDataTransferApi" id="@cdklabs/cdk-appflow.SalesforceDataTransferApi"></a>

The default.

Amazon AppFlow selects which API to use based on the number of records that your flow transfers to Salesforce. If your flow transfers fewer than 1,000 records, Amazon AppFlow uses Salesforce REST API. If your flow transfers 1,000 records or more, Amazon AppFlow uses Salesforce Bulk API 2.0.

Each of these Salesforce APIs structures data differently. If Amazon AppFlow selects the API automatically, be aware that, for recurring flows, the data output might vary from one flow run to the next. For example, if a flow runs daily, it might use REST API on one day to transfer 900 records, and it might use Bulk API 2.0 on the next day to transfer 1,100 records. For each of these flow runs, the respective Salesforce API formats the data differently. Some of the differences include how dates are formatted and null values are represented. Also, Bulk API 2.0 doesn't transfer Salesforce compound fields.

By choosing this option, you optimize flow performance for both small and large data transfers, but the tradeoff is inconsistent formatting in the output.

#### Members <a name="Members" id="Members"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceDataTransferApi.AUTOMATIC">AUTOMATIC</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceDataTransferApi.BULKV2">BULKV2</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceDataTransferApi.REST_SYNC">REST_SYNC</a></code> | *No description.* |

---

##### `AUTOMATIC` <a name="AUTOMATIC" id="@cdklabs/cdk-appflow.SalesforceDataTransferApi.AUTOMATIC"></a>

---


##### `BULKV2` <a name="BULKV2" id="@cdklabs/cdk-appflow.SalesforceDataTransferApi.BULKV2"></a>

---


##### `REST_SYNC` <a name="REST_SYNC" id="@cdklabs/cdk-appflow.SalesforceDataTransferApi.REST_SYNC"></a>

---


### SalesforceMarketingCloudApiVersions <a name="SalesforceMarketingCloudApiVersions" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudApiVersions"></a>

A helper enum for SFMC api version.

#### Members <a name="Members" id="Members"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.SalesforceMarketingCloudApiVersions.V1">V1</a></code> | *No description.* |

---

##### `V1` <a name="V1" id="@cdklabs/cdk-appflow.SalesforceMarketingCloudApiVersions.V1"></a>

---


### WriteOperationType <a name="WriteOperationType" id="@cdklabs/cdk-appflow.WriteOperationType"></a>

#### Members <a name="Members" id="Members"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-appflow.WriteOperationType.DELETE">DELETE</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.WriteOperationType.INSERT">INSERT</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.WriteOperationType.UPDATE">UPDATE</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-appflow.WriteOperationType.UPSERT">UPSERT</a></code> | *No description.* |

---

##### `DELETE` <a name="DELETE" id="@cdklabs/cdk-appflow.WriteOperationType.DELETE"></a>

---


##### `INSERT` <a name="INSERT" id="@cdklabs/cdk-appflow.WriteOperationType.INSERT"></a>

---


##### `UPDATE` <a name="UPDATE" id="@cdklabs/cdk-appflow.WriteOperationType.UPDATE"></a>

---


##### `UPSERT` <a name="UPSERT" id="@cdklabs/cdk-appflow.WriteOperationType.UPSERT"></a>

---

