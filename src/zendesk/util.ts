/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
export class ZendeskInstanceUrlBuilder {
  public static buildFromAccount(account: string): string {
    return `https://${account}.zendesk.com`;
  }
}
