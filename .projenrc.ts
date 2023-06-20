import { CdklabsConstructLibrary } from 'cdklabs-projen-project-types';
const project = new CdklabsConstructLibrary({
  name: '@cdklabs/cdk-appflow',
  author: 'Amazon Web Services',
  authorAddress: 'cdk-appflow-maintainers@amazon.com',
  cdkVersion: '2.83.0',
  defaultReleaseBranch: 'main',
  devDeps: ['cdklabs-projen-project-types'],
  minNodeVersion: '16.0.0',
  projenrcTs: true,
  release: false,
  repositoryUrl: 'https://github.com/cdklabs/cdk-appflow.git',
  publishToGo: {
    moduleName: 'github.com/cdklabs/cdk-appflow-go',
  },
  publishToPypi: {
    distName: 'cdklabs.cdk-appflow',
    module: 'cdklabs.cdk_appflow',
  },
  publishToMaven: {
    mavenGroupId: 'io.github.cdklabs',
    javaPackage: 'io.github.cdklabs.cdkappflow',
    mavenArtifactId: 'cdk-appflow',
  },
  publishToNuget: {
    dotNetNamespace: 'Cdklabs.CdkAppflow',
    packageId: 'Cdklabs.CdkAppflow',
  },

});
project.synth();