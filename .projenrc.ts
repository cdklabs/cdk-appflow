import { CdklabsConstructLibrary } from 'cdklabs-projen-project-types';
import { Stability } from 'projen/lib/cdk';

const project = new CdklabsConstructLibrary({
  name: '@cdklabs/cdk-appflow',
  author: 'Amazon Web Services',
  authorAddress: 'cdk-appflow-maintainers@amazon.com',
  cdkVersion: '2.84.0',
  defaultReleaseBranch: 'main',
  minNodeVersion: '16.0.0',
  projenrcTs: true,
  private: false,
  repositoryUrl: 'https://github.com/cdklabs/cdk-appflow.git',
  stability: Stability.EXPERIMENTAL,
  docgen: true,
  peerDeps: [
    '@aws-cdk/aws-redshift-alpha@2.84.0-alpha.0',
    '@aws-cdk/aws-glue-alpha@2.84.0-alpha.0',
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