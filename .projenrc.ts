/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CdklabsConstructLibrary } from 'cdklabs-projen-project-types';
import { Stability } from 'projen/lib/cdk';

const cdkVersion = /* workflow-upgrade-cdk-version */'2.121.0'/* workflow-upgrade-cdk-version */;

const project = new CdklabsConstructLibrary({
  name: '@cdklabs/cdk-appflow',
  author: 'Amazon Web Services',
  authorAddress: 'cdk-appflow-maintainers@amazon.com',
  cdkVersion,
  defaultReleaseBranch: 'main',
  projenrcTs: true,
  private: false,
  repositoryUrl: 'https://github.com/cdklabs/cdk-appflow.git',
  stability: Stability.EXPERIMENTAL,
  docgen: true,
  bundledDeps: ['@types/aws-lambda'],
  devDeps: ['esbuild'],
  peerDeps: [
    `@aws-cdk/aws-redshift-alpha@${cdkVersion}-alpha.0`,
    `@aws-cdk/aws-glue-alpha@${cdkVersion}-alpha.0`,
  ],
  keywords: [
    'aws',
    'appflow',
    'cdk',
  ],
  gitignore: [
    '*.rest', '.vscode', '**/.DS_Store',
  ],
});
project.synth();
