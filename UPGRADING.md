# Upgrading

## 0.0.x to 0.1.x
Release [0.1.0](https://github.com/cdklabs/cdk-appflow/releases/tag/v0.1.0) has changed how CDK generates `FlowName` property of `AWS::AppFlow::Flow` constructs.

AppFlow requires `FlowName` property to be stable so after upgrade to 0.1.0, `cdk diff` will produce change like this:

```
Resources
[~] AWS::AppFlow::Flow OnDemandFlow OnDemandFlow4ECA54C5 replace
 └─ [~] FlowName (requires replacement)
     ├─ [-] OnDemandFlow
     └─ [+] TestStackOnDemandFlow2E777DF5
 ```

If applied, this diff will destroy the old OnDemandFlow and create new one. 
To prevent recreate, user can restore original `FlowName` property with following code:
```typescript
import { IFlow } from '@cdklabs/cdk-appflow';
import { CfnFlow } from 'aws-cdk-lib/aws-appflow';

declare const flow: IFlow;

const flowNode = flow.node.defaultChild as CfnFlow;
flowNode.flowName = "OnDemandFlow"
```

Once applied, another run of `cdk diff` should produce `There were no differences`

## 0.1.x to 0.2.x
Release [0.2.0](https://github.com/cdklabs/cdk-appflow/releases/tag/v0.2.0) has changed logical ID of `AWS::AppFlow::Flow` constructs. 
As a result, `cdk diff` produces change like this:
```
Resources
[-] AWS::AppFlow::Flow OnDemandFlow/OnDemandFlow OnDemandFlow4ECA54C5 destroy
[+] AWS::AppFlow::Flow OnDemandFlow OnDemandFlow00CE33FE
 ```

If applied, this diff will destroy the old OnDemandFlow and create new one.
To prevent recreate, user can override logical ID with following code:
```typescript
import { IFlow } from '@cdklabs/cdk-appflow';
import { CfnFlow } from 'aws-cdk-lib/aws-appflow';

declare const flow: IFlow;

const flowNode = flow.node.defaultChild as CfnFlow;
flowNode.overrideLogicalId("OnDemandFlow4ECA54C5");
```

Once applied, another run of `cdk diff` should produce `There were no differences`
