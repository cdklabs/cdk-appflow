import { CdklabsConstructLibrary } from 'cdklabs-projen-project-types';
const project = new CdklabsConstructLibrary({
  name: '@cdklabs/cdk-appflow',
  author: 'Amazon Web Services',
  authorAddress: 'cdk-appflow-maintainers@amazon.com',
  cdkVersion: '2.83.0',
  defaultReleaseBranch: 'main',
  minNodeVersion: '16.0.0',
  projenrcTs: true,
  private: false,
  repositoryUrl: 'https://github.com/cdklabs/cdk-appflow.git',

});
project.synth();