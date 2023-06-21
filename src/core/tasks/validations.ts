/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Field } from './field';
import { IOperation, OperationBase } from './operation';
import { Task } from './tasks';

/**
 * A representation of a validation condition on a particular field in a flow execution
 */
export class ValidationCondition {

  /**
   * Validates whether a particular field in an execution is negative
   * @param field a field for which the validation will be performed
   * @returns a @see ValidationCondition instance
   */
  public static isNegative(field: string | Field) {
    return new ValidationCondition(typeof field === 'string' ? field : field.name, 'VALIDATE_NON_NEGATIVE');
  }

  /**
   * Validates whether a particular field has no value
   * @param field a field for which the validation will be performed
   * @returns a @see ValidationCondition instance
   */
  public static isNull(field: string | Field) {
    return new ValidationCondition(typeof field === 'string' ? field : field.name, 'VALIDATE_NON_NULL');
  }

  // TODO: make sure that you understand what's here
  /**
   *
   * @param field a field for which the validation will be performed
   * @returns a @see ValidationCondition instance
   */
  public static isNotNull(field: string | Field) {
    return new ValidationCondition(typeof field === 'string' ? field : field.name, 'VALIDATE_NUMERIC');
  }

  // TODO: make sure that you understand what's here
  /**
   *
   * @param field a field for which the validation will be performed
   * @returns a @see ValidationCondition instance
   */
  public static isDefault(field: string | Field) {
    return new ValidationCondition(typeof field === 'string' ? field : field.name, 'VALIDATE_NON_ZERO');
  }

  protected constructor(
    public readonly field: string,
    public readonly validation: string) { }
}

export class ValidationAction {
  /**
   *
   * @returns a @see ValidationAction that removes a record from the flow execution result
   */
  public static ignoreRecord() { return new ValidationAction('DropRecord'); }

  /**
   *
   * @returns a @see ValidationAction that terminates the whole flow execution
   */
  public static terminateFlow() { return new ValidationAction('DropDataset'); }

  protected constructor(public readonly action: string) { }
}

/**
 * A representation of a validation operation, that is an operation testing records and acting on the test results
 */
export interface IValidation extends IOperation { }

/**
 * A representation of a validation operation, that is an operation testing records and acting on the test results
 */
export class Validation extends OperationBase implements IValidation {

  /**
   *
   * @param condition a @see ValidationCondition for the validation
   * @param action a @see ValidationAction for the validation
   * @returns a Validation instance
   */
  public static when(condition: ValidationCondition, action: ValidationAction) : IValidation {
    return new Validation(condition, action);
  }

  protected constructor(
    readonly condition: ValidationCondition,
    readonly action: ValidationAction) {
    super([new Task('Validate',
      [condition.field],
      { operation: condition.validation },
      { VALIDATION_ACTION: action.action })]);
  }
}
