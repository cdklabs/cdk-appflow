/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Bucket } from 'aws-cdk-lib/aws-s3';

import {
  Mapping,
  MicrosoftSharepointOnlineApiVersion,
  MicrosoftSharepointOnlineConnectorProfile,
  MicrosoftSharepointOnlineConnectorType,
  MicrosoftSharepointOnlineSource,
  OnDemandFlow,
  S3Destination,
} from '../../src';

describe('MicrosoftSharepointOnlineSource', () => {

  test('Source with only connector name', () => {
    const stack = new Stack(undefined, 'TestStack');
    const source = new MicrosoftSharepointOnlineSource({
      profile: MicrosoftSharepointOnlineConnectorProfile.fromConnectionProfileName(stack, 'TestProfile', 'dummy-profile'),
      object: {
        site: 'sites/dummysite.sharepoint.com,3f42g340-bc23-4a31-b7e5-722e57c39cb8,5bbc39fb-2b17-423b-a007-40ca508389a5',
        entities: ['drives/b!fcPDltwTLSougEJuDFjE?U5qHuXbkzlvSaA5oNoMW4tB0y6mebcx9m-ckwA9KtKE'],
      },
      apiVersion: MicrosoftSharepointOnlineApiVersion.V1,
    });

    const expectedConnectorType = MicrosoftSharepointOnlineConnectorType.instance;
    expect(source.connectorType.asProfileConnectorLabel).toEqual(expectedConnectorType.asProfileConnectorLabel);
    expect(source.connectorType.asProfileConnectorType).toEqual(expectedConnectorType.asProfileConnectorType);
    expect(source.connectorType.asTaskConnectorOperatorOrigin).toEqual(expectedConnectorType.asTaskConnectorOperatorOrigin);
    expect(source.connectorType.isCustom).toEqual(expectedConnectorType.isCustom);
  });

  test('Source in a Flow is in the stack', () => {
    const stack = new Stack(undefined, 'TestStack');
    const source = new MicrosoftSharepointOnlineSource({
      profile: MicrosoftSharepointOnlineConnectorProfile.fromConnectionProfileName(stack, 'TestProfile', 'dummy-profile'),
      object: {
        site: 'sites/dummysite.sharepoint.com,3f42g340-bc23-4a31-b7e5-722e57c39cb8,5bbc39fb-2b17-423b-a007-40ca508389a5',
        entities: ['drives/b!fcPDltwTLSougEJuDFjE?U5qHuXbkzlvSaA5oNoMW4tB0y6mebcx9m-ckwA9KtKE'],
      },
      apiVersion: MicrosoftSharepointOnlineApiVersion.V1,
    });

    const destination = new S3Destination({
      location: { bucket: new Bucket(stack, 'TestBucket') },
    });

    new OnDemandFlow(stack, 'TestFlow', {
      source: source,
      destination: destination,
      mappings: [Mapping.mapAll()],
    });

    Template.fromStack(stack).hasResourceProperties('AWS::AppFlow::Flow', {
      DestinationFlowConfigList: [
        {
          ConnectorType: 'S3',
          DestinationConnectorProperties: {
            S3: {
              BucketName: {
                Ref: 'TestBucket560B80BC',
              },
            },
          },
        },
      ],
      FlowName: 'TestFlow',
      SourceFlowConfig: {
        ApiVersion: 'v1.0',
        ConnectorProfileName: 'dummy-profile',
        ConnectorType: 'CustomConnector',
        SourceConnectorProperties: {
          CustomConnector: {
            EntityName: 'sites/dummysite.sharepoint.com,3f42g340-bc23-4a31-b7e5-722e57c39cb8,5bbc39fb-2b17-423b-a007-40ca508389a5',
            CustomProperties: {
              subEntities: '["drives/b!fcPDltwTLSougEJuDFjE?U5qHuXbkzlvSaA5oNoMW4tB0y6mebcx9m-ckwA9KtKE"]',
            },
          },
        },
      },
      Tasks: [
        {
          ConnectorOperator: {
            CustomConnector: 'NO_OP',
          },
          SourceFields: [],
          TaskProperties: [
            {
              Key: 'EXCLUDE_SOURCE_FIELDS_LIST',
              Value: '[]',
            },
          ],
          TaskType: 'Map_all',
        },
      ],
      TriggerConfig: {
        TriggerType: 'OnDemand',
      },
    });
  });

  test('Source for dummy-profile in a Flow is in the stack', () => {
    const stack = new Stack(undefined, 'TestStack');

    const profile = new MicrosoftSharepointOnlineConnectorProfile(stack, 'TestProfile', {
      oAuth: {
        accessToken: 'accessToken',
        flow: {
          refreshTokenGrant: {
            refreshToken: 'refreshToken',
            clientId: 'clientId',
            clientSecret: 'clientSecret',
          },
        },
        endpoints: {
          token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        },
      },
    });

    const source = new MicrosoftSharepointOnlineSource({
      profile: profile,
      object: {
        site: 'sites/dummysite.sharepoint.com,3f42g340-bc23-4a31-b7e5-722e57c39cb8,5bbc39fb-2b17-423b-a007-40ca508389a5',
        entities: ['drives/b!fcPDltwTLSougEJuDFjE?U5qHuXbkzlvSaA5oNoMW4tB0y6mebcx9m-ckwA9KtKE'],
      },
      apiVersion: MicrosoftSharepointOnlineApiVersion.V1,
    });

    const destination = new S3Destination({
      location: { bucket: new Bucket(stack, 'TestBucket') },
    });

    new OnDemandFlow(stack, 'TestFlow', {
      source: source,
      destination: destination,
      mappings: [Mapping.mapAll()],
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::AppFlow::ConnectorProfile', {
      ConnectionMode: 'Public',
      ConnectorProfileName: 'TestProfile',
      ConnectorType: 'CustomConnector',
      ConnectorLabel: 'MicrosoftSharePointOnline',
      ConnectorProfileConfig: {
        ConnectorProfileCredentials: {
          CustomConnector: {
            AuthenticationType: 'OAUTH2',
            Oauth2: {
              AccessToken: 'accessToken',
              ClientId: 'clientId',
              ClientSecret: 'clientSecret',
              RefreshToken: 'refreshToken',
            },
          },
        },
        ConnectorProfileProperties: {
          CustomConnector: {
            OAuth2Properties: {
              OAuth2GrantType: 'AUTHORIZATION_CODE',
              TokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
            },
          },
        },
      },
    });

    template.hasResource('AWS::AppFlow::Flow', {
      Properties: {
        DestinationFlowConfigList: [
          {
            ConnectorType: 'S3',
            DestinationConnectorProperties: {
              S3: {
                BucketName: {
                  Ref: 'TestBucket560B80BC',
                },
              },
            },
          },
        ],
        FlowName: 'TestFlow',
        SourceFlowConfig: {
          ApiVersion: 'v1.0',
          ConnectorProfileName: 'TestProfile',
          ConnectorType: 'CustomConnector',
          SourceConnectorProperties: {
            CustomConnector: {
              EntityName: 'sites/dummysite.sharepoint.com,3f42g340-bc23-4a31-b7e5-722e57c39cb8,5bbc39fb-2b17-423b-a007-40ca508389a5',
              CustomProperties: {
                subEntities: '["drives/b!fcPDltwTLSougEJuDFjE?U5qHuXbkzlvSaA5oNoMW4tB0y6mebcx9m-ckwA9KtKE"]',
              },
            },
          },
        },
        Tasks: [
          {
            ConnectorOperator: {
              CustomConnector: 'NO_OP',
            },
            SourceFields: [],
            TaskProperties: [
              {
                Key: 'EXCLUDE_SOURCE_FIELDS_LIST',
                Value: '[]',
              },
            ],
            TaskType: 'Map_all',
          },
        ],
        TriggerConfig: {
          TriggerType: 'OnDemand',
        },
      },
      DependsOn: [
        'TestBucketPolicyBA12ED38',
        'TestBucket560B80BC',
        'TestProfile45C36389',
      ],
    });
  });
});
