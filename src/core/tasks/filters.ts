/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Field } from "./field";
import { IOperation, OperationBase } from "./operation";
import { Task, TaskProperty } from "./tasks";

/**
 * A representation of a filter operation condtiion on a source record field
 */
export class FilterCondition {
  /**
   * A condition testing whether a string-type source field contains the given value(s).
   * NOTE: When multiple values are passed the evaluation is resolved as logical OR
   * @param field a source field of a string type
   * @param val a value (or values) to be contained by the field value
   * @returns an instance of a @see FilterCondition
   */
  public static stringContains(field: Field, val: string | string[]) {
    return FilterCondition.stringCondition(field, val, "CONTAINS");
  }

  /**
   * A condition testing whether a string-type source field equals the given value(s).
   * NOTE: When multiple values are passed the evaluation is resolved as logical OR
   * @param field a source field of a string type
   * @param val a value (or values) to be contained by the field value
   * @returns an instance of a @see FilterCondition
   */
  public static stringEquals(field: Field, val: string | string[]) {
    return FilterCondition.stringCondition(field, val, "EQUAL_TO");
  }

  /**
   * A condition testing whether a string-type source field does not equal the given value(s).
   * NOTE: When multiple values are passed the evaluation is resolved as logical OR
   * @param field a source field of a string type
   * @param val a value (or values) to be contained by the field value
   * @returns an instance of a @see FilterCondition
   */
  public static stringNotEquals(field: Field, val: string | string[]) {
    return FilterCondition.stringCondition(field, val, "NOT_EQUAL_TO");
  }

  public static booleanEquals(field: Field, val: boolean | boolean[]) {
    return FilterCondition.booleanCondition(field, val, "EQUAL_TO");
  }

  public static booleanNotEquals(field: Field, val: boolean | boolean[]) {
    return FilterCondition.booleanCondition(field, val, "NOT_EQUAL_TO");
  }

  public static numberEquals(field: Field, val: number | number[]) {
    return FilterCondition.numberCondition(field, val, "EQUAL_TO");
  }

  public static numberNotEquals(field: Field, val: number | number[]) {
    return FilterCondition.numberCondition(field, val, "NOT_EQUAL_TO");
  }

  public static numberLessThan(field: Field, val: number) {
    return FilterCondition.numberCondition(field, val, "LESS_THAN");
  }

  public static numberLessThanEquals(field: Field, val: number) {
    return FilterCondition.numberCondition(field, val, "LESS_THAN_OR_EQUAL_TO");
  }

  public static numberGreaterThan(field: Field, val: number) {
    return FilterCondition.numberCondition(field, val, "GREATER_THAN");
  }

  public static numberGreaterThanEquals(field: Field, val: number) {
    return FilterCondition.numberCondition(
      field,
      val,
      "GREATER_THAN_OR_EQUAL_TO",
    );
  }

  public static timestampEquals(field: Field, val: Date | Date[]) {
    return FilterCondition.timestampCondition(field, val, "EQUAL_TO");
  }

  public static timestampNotEquals(field: Field, val: Date | Date[]) {
    return FilterCondition.timestampCondition(field, val, "NOT_EQUAL_TO");
  }

  public static timestampLessThan(field: Field, val: Date | Date[]) {
    return FilterCondition.timestampCondition(field, val, "LESS_THAN");
  }

  public static timestampLessThanEquals(field: Field, val: Date | Date[]) {
    return FilterCondition.timestampCondition(
      field,
      val,
      "LESS_THAN_OR_EQUAL_TO",
    );
  }

  public static timestampGreaterThan(field: Field, val: Date | Date[]) {
    return FilterCondition.timestampCondition(field, val, "GREATER_THAN");
  }

  public static timestampGreaterThanEquals(field: Field, val: Date | Date[]) {
    return FilterCondition.timestampCondition(
      field,
      val,
      "GREATER_THAN_OR_EQUAL_TO",
    );
  }

  public static timestampBetween(field: Field, lower: Date, upper: Date) {
    return new FilterCondition(field, "BETWEEN", [
      { key: "DATA_TYPE", value: field.dataType! },
      { key: "LOWER_BOUND", value: this.valueToString(lower) },
      { key: "UPPER_BOUND", value: this.valueToString(upper) },
    ]);
  }

  private static stringCondition(
    field: Field,
    val: string | string[],
    filter: string,
  ) {
    if (Array.isArray(val)) {
      return new FilterCondition(field, filter, [
        { key: "DATA_TYPE", value: field.dataType! },
        {
          key: "VALUES",
          value: val.map((m) => this.valueToString(m)).join(","),
        },
      ]);
    }

    return new FilterCondition(field, filter, [
      { key: "DATA_TYPE", value: field.dataType! },
      { key: "VALUE", value: this.valueToString(val) },
    ]);
  }

  private static numberCondition(
    field: Field,
    val: number | number[],
    filter: string,
  ) {
    if (Array.isArray(val)) {
      return new FilterCondition(field, filter, [
        { key: "DATA_TYPE", value: field.dataType! },
        {
          key: "VALUES",
          value: val.map((m) => this.valueToString(m)).join(","),
        },
      ]);
    }

    return new FilterCondition(field, filter, [
      { key: "DATA_TYPE", value: field.dataType! },
      { key: "VALUE", value: this.valueToString(val) },
    ]);
  }

  private static booleanCondition(
    field: Field,
    val: boolean | boolean[],
    filter: string,
  ) {
    if (Array.isArray(val)) {
      return new FilterCondition(field, filter, [
        { key: "DATA_TYPE", value: field.dataType! },
        {
          key: "VALUES",
          value: val.map((m) => this.valueToString(m)).join(","),
        },
      ]);
    }

    return new FilterCondition(field, filter, [
      { key: "DATA_TYPE", value: field.dataType! },
      { key: "VALUE", value: this.valueToString(val) },
    ]);
  }

  private static timestampCondition(
    field: Field,
    val: Date | Date[],
    filter: string,
  ) {
    if (Array.isArray(val)) {
      return new FilterCondition(field, filter, [
        { key: "DATA_TYPE", value: field.dataType! },
        {
          key: "VALUES",
          value: val.map((m) => this.valueToString(m)).join(","),
        },
      ]);
    }

    return new FilterCondition(field, filter, [
      { key: "DATA_TYPE", value: field.dataType! },
      { key: "VALUE", value: this.valueToString(val) },
    ]);
  }

  private static valueToString(
    value: string | number | boolean | Date,
  ): string {
    const t = typeof value;

    switch (t) {
      case "string":
        return value as string;
      case "number":
      case "boolean":
        return `${value}`;
      default: // meaning: Date
        return (value as Date).getTime().toString();
    }
  }

  constructor(
    public readonly field: Field,
    public readonly filter: string,
    public readonly properties: TaskProperty[],
  ) {
    if (!field.dataType) {
      throw new Error("field dataType required");
    }
  }
}

/**
 * A representation of a mapping operation, that is an operation filtering records at the source
 */
export interface IFilter extends IOperation {}

/**
 * A representation of a mapping operation, that is an operation filtering records at the source
 */
export class Filter extends OperationBase implements IFilter {
  /**
   * Builds a filter operation on source
   * @param condition a @see FilterCondition instance
   * @returns
   */
  public static when(condition: FilterCondition) {
    return new Filter(condition);
  }

  protected constructor(readonly condition: FilterCondition) {
    super([
      new Task(
        "Filter",
        [condition.field.name],
        // TODO: think about source/destination here
        { operation: condition.filter },
        condition.properties,
      ),
    ]);
  }
}
