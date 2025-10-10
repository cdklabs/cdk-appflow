/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/

/**
 * A utility class for building Microsoft Online token URLs.
 */
export class MicrosoftSharepointOnlineTokenUrlBuilder {
  public static buildTokenUrl(tenantId?: string) {
    return `https://login.microsoftonline.com/${tenantId ?? "common"}/oauth2/v2.0/token`;
  }
}

/**
 * An enum representing the Microsoft Sharepoint Online API versions.
 */
export enum MicrosoftSharepointOnlineApiVersion {
  /**
   * Version 1.0
   */
  V1 = "v1.0",
}
