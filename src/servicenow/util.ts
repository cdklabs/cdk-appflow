/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
export class ServiceNowInstanceUrlBuilder {
  public static buildFromDomain(domain: string): string {
    return `https://${domain}.service-now.com`;
  }
}
