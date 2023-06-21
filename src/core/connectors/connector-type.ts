/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
export class ConnectorType {

  protected constructor(protected readonly name: string, public readonly isCustom: boolean) { }

  public get asProfileConnectorType(): string {
    return this.isCustom
      ? 'CustomConnector'
      : `${this.name[0].toUpperCase()}${this.name.substring(1).toLowerCase()}`;
  }

  public get asTaskConnectorOperatorOrigin(): string {
    return this.isCustom
      ? 'customConnector'
      : `${this.name[0].toLowerCase()}${this.name.substring(1)}`;
  }

  public get asProfileConnectorLabel(): string | undefined {
    return this.isCustom
      ? this.name
      : undefined;
  }
}
