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
      refreshTokenGrant: {
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