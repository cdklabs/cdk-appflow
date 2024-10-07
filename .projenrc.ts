/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CdklabsConstructLibrary } from 'cdklabs-projen-project-types';
import { Stability } from 'projen/lib/cdk';

const cdkVersion = '2.159.1';

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
  bundledDeps: [],
  devDeps: [
    '@types/aws-lambda',
    'esbuild',
  ],
  peerDeps: [
    `@aws-cdk/aws-redshift-alpha@${cdkVersion}-alpha.0`,
    `@aws-cdk/aws-glue-alpha@${cdkVersion}-alpha.0`,
  ],
  jsiiVersion: '~5.4.30',
  keywords: [
    'aws',
    'appflow',
    'cdk',
  ],
  gitignore: [
    '*.rest', '.vscode', '**/.DS_Store',
  ],
  jestOptions: {
    jestVersion: '^29',
  },
});
project.synth();
