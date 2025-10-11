/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { ConnectorType } from "../core/connectors/connector-type";

/**
 * @internal
 */
export class GitHubConnectorType extends ConnectorType {
  public static get instance(): ConnectorType {
    if (!GitHubConnectorType.actualInstance) {
      GitHubConnectorType.actualInstance = new GitHubConnectorType();
    }
    return GitHubConnectorType.actualInstance;
  }

  private static actualInstance: ConnectorType;

  constructor() {
    super("GitHub", true);
  }
}
