/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
/* eslint-disable no-console */
exports.onEvent = async function (event) {
  switch (event.RequestType) {
    case 'Create':
    case 'Update':
      return updateFlowTime(event);
    case 'Delete':
      return;
  }
}

async function updateFlowTime(event) {

  let expressionString = event.ResourceProperties['Schedule'];

  const propStartTime = event.ResourceProperties['StartTime'];
  let startTime = propStartTime
    ? new Date(Date.parse(propStartTime))
    : undefined;

  const propEndTime = event.ResourceProperties['EndTime'];
  let endTime = propEndTime
    ? new Date(Date.parse(propEndTime))
    : undefined;

  if (/^rate/.test(expressionString)) {
    ({ expressionString, startTime } = buildForRateBasedSchedule(expressionString, startTime));
  } else if (/^cron/.test(expressionString)) {
    // do nothing, as we don't change the expressionString
    // TODO: do we have to set the startTime? I think we do
  } else {
    throw new Error(`Unrecognized expression ${expressionString}`);
  }

  return {
    Data: {
      ['Schedule']: expressionString,
      ['StartTime']: startTime && startTime.getTime() / 1000,
      ['EndTime']: endTime && endTime.getTime() / 1000,
    },
  };
}

function buildForRateBasedSchedule(expressionString, startTime) {

  // TODO: the below statement is from a customer. I need to check it more thoroughly
  // Rebuilding expression string as Flows require always plural, so: hour -> hours, etc.
  const matches = /\((\d*)(.*)\)$/.exec(expressionString);
  if (!matches) {
    throw new Error(`Expression ${expressionString} is not a rate-based expression`);
  }

  const rate = parseFloat(matches[1]);
  let rateUnit = matches[2].trim();
  if (!rateUnit.endsWith('s')) {
    rateUnit = `${rateUnit}s`;
  }

  expressionString = `rate(${rate} ${rateUnit})`;

  if (startTime) {

    const nowMillis = Date.now();
    const startMillis = startTime.getTime();
    if (nowMillis > startMillis) {

      let denominator = 1;

      switch (rateUnit) {
        case 'minutes':
          denominator = 60 * 1000; // minutes in millis
          break;
        case 'hours':
          denominator = 60 * 60 * 1000; // hours in millis
          break;
        case 'days':
          denominator = 24 * 60 * 60 * 1000; // days in millis
          break;
        default:
          throw new Error(`Unable to use schedule "${expressionString}"`);
      }

      const cyclesBetween = Math.ceil((nowMillis - startMillis) / denominator / rate);

      startTime = new Date((startMillis / denominator + cyclesBetween * rate) * denominator);
    }
  }

  return { expressionString, startTime };
}