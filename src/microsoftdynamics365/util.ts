/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/

/**
 * A utility class for building Microsoft Dynamics 365 token URLs.
 */
export class MicrosoftDynamics365TokenUrlBuilder {
  public static buildTokenUrl(tenantId?: string) {
    return `https://login.microsoftonline.com/${tenantId ?? "common"}/oauth2/v2.0/token`;
  }
}

export class MicrosoftDynamics365ApiUrlBuilder {
  public static buildApiUrl(org: string) {
    return `https://${org}.api.crm.dynamics.com`;
  }
}

/**
 * An enum representing the Microsoft Dynamics 365 API versions.
 */
export enum MicrosoftDynamics365ApiVersion {
  /**
   * Version 9.2
   */
  V9_2 = "v9.2",
}
