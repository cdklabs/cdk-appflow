/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
export class SlackInstanceUrlBuilder {
  public static buildFromWorkspace(workspace: string): string {
    return `https://${workspace}.slack.com`;
  }
}
