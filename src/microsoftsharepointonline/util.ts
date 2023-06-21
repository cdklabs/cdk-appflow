/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
export class MicrosoftSharepointOnlineTokenUrlBuilder {
  public static buildFromTenant(tenantId: string) {
    return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  }
}

export enum MicrosoftSharepointOnlineApiVersion {
  V1 = 'v1.0'
}