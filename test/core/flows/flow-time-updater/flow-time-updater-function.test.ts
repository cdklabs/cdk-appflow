import { Duration } from "aws-cdk-lib";
import { Schedule } from "aws-cdk-lib/aws-events";
import type { CloudFormationCustomResourceEvent } from "aws-lambda";
import * as API from "../../../../src/core/flows/flow-time-updater/api";
import { handler } from "../../../../src/core/flows/flow-time-updater/flow-time-updater.lambda";

describe("flow time updater function", () => {
  it("converts CDK rate expressions to AppFlow rate expressions", async () => {
    const cdkExpression = Schedule.rate(Duration.days(1)).expressionString;
    expect(cdkExpression).toEqual("rate(1 day)"); // validate assumption

    const result = await handler(createEvent({ schedule: cdkExpression }));

    expect(result).toEqual({
      Data: {
        [API.ATTR_SCHEDULE]: "rate(1days)", // no space + pluralized
        [API.ATTR_STARTTIME]: undefined,
        [API.ATTR_ENDTIME]: undefined,
      },
    });
  });
});

function createEvent(props: {
  schedule: string;
  startTime?: string;
  endTime?: string;
}): CloudFormationCustomResourceEvent {
  const { schedule, startTime, endTime } = props;

  const event: CloudFormationCustomResourceEvent = {
    RequestType: "Create",
    ResourceProperties: {
      [API.PROP_SCHEDULE]: schedule,
      [API.PROP_STARTTIME]: startTime,
      [API.PROP_ENDTIME]: endTime,
      ServiceToken: "",
    },

    // These are boilerplate values that are not used in the function
    ServiceToken: "",
    ResponseURL: "",
    StackId: "",
    RequestId: "",
    LogicalResourceId: "",
    ResourceType: "",
  };
  return event;
}
