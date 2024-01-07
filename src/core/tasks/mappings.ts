/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Fn } from 'aws-cdk-lib';
import { Field } from './field';
import { IOperation, OperationBase } from './operation';
import { Task, TaskProperty } from './tasks';

const TT_MAPALL = 'Map_all';
const TT_MAP = 'Map';
const TT_MERGE = 'Merge';
const TT_ARITHMETIC = 'Arithmetic';

const OP_NOOP = 'NO_OP';
const OP_ADDITION = 'ADDITION';
const OP_SUBTRACTION = 'SUBTRACTION';
const OP_MULTIPLICATION = 'MULTIPLICATION';
const OP_DIVISION = 'DIVISION';

const TP_SOURCE_DATA_TYPE = 'SOURCE_DATA_TYPE';
const TP_DESTINATION_DATA_TYPE = 'DESTINATION_DATA_TYPE';

/**
 * A representation of a mapping operation, that is an operation translating source to destination fields
 */
export interface IMapping extends IOperation { }

/**
 * A helper interface
 */
export interface MapAllConfig {
  // a list of source fields to exclude
  readonly exclude: string[];
}

/**
 * A representation of an instance of a mapping operation, that is an operation translating source to destination fields
 */
export class Mapping extends OperationBase implements IMapping {
  public static mapAll(config?: MapAllConfig): IMapping {
    return new Mapping([
      new Task(
        TT_MAPALL, [],
        { operation: OP_NOOP },
        [{ key: 'EXCLUDE_SOURCE_FIELDS_LIST', value: config ? `["${Fn.join('","', config.exclude)}"]` : '[]' }],
      ),
    ]);
  }
  public static map(from: Field, to: Field): IMapping {
    const props: TaskProperty[] = [];

    if (from.dataType) {
      props.push({ key: TP_SOURCE_DATA_TYPE, value: from.dataType });
    }

    if (to.dataType) {
      props.push({ key: TP_DESTINATION_DATA_TYPE, value: to.dataType });
    }

    return new Mapping([
      new Task(TT_MAP, [from.name], { operation: OP_NOOP }, props, to.name),
    ]);
  }

  /**
   * A mapping definition building concatenation of source fields into a destination field
   * @param from an array of source fields
   * @param to a desintation field
   * @param format a format
   * @returns a mapping instance with concatenation definition
   */
  public static concat(from: Field[], to: Field, format: string) {

    if (!to.dataType) {
      throw new Error('dataType for \'to\' required');
    }

    const tmpField = from.map(f => f.name).join(',');
    return new Mapping([
      new Task(TT_MERGE, from.map(f => f.name), { operation: OP_NOOP },
        [{ key: 'CONCAT_FORMAT', value: format }], tmpField),
      new Task(TT_MAP, [tmpField], { operation: OP_NOOP }, [
        { key: 'DESTINATION_DATA_TYPE', value: to.dataType },
        { key: 'SOURCE_DATA_TYPE', value: 'string' },
      ]),
    ]);
  }

  /**
   * Specifies an addition mapping of two numeric values from asource to a destination
   * @param sourceField1 a numeric value
   * @param sourceField2 a numeric value
   * @param to a numeric value
   * @returns an IMapping instance
   */
  public static add(sourceField1: Field, sourceField2: Field, to: Field) {
    return Mapping.arithmetic(sourceField1, sourceField2, to, OP_ADDITION);
  }

  /**
   * Specifies a multiplication mapping of two numeric values from a source to a destination
   * @param sourceField1 a numeric value
   * @param sourceField2 a numeric value
   * @param to a numeric value
   * @returns an IMapping instance
   */
  public static multiply(sourceField1: Field, sourceField2: Field, to: Field) {
    return Mapping.arithmetic(sourceField1, sourceField2, to, OP_MULTIPLICATION);
  }

  /**
   * Specifies a subtraction mapping of two numeric values from a source to a destination
   * @param sourceField1 a numeric value
   * @param sourceField2 a numeric value
   * @param to a numeric value
   * @returns an IMapping instance
   */
  public static subtract(sourceField1: Field, sourceField2: Field, to: Field) {
    return Mapping.arithmetic(sourceField1, sourceField2, to, OP_SUBTRACTION);
  }

  /**
   * Specifies a division mapping of two numeric values from a source to a destination
   * @param sourceField1 a numeric value
   * @param sourceField2 a numeric value
   * @param to a numeric value
   * @returns an IMapping instance
   */
  public static divide(sourceField1: Field, sourceField2: Field, to: Field) {
    return Mapping.arithmetic(sourceField1, sourceField2, to, OP_DIVISION);
  }

  /**
   * Specifies an arithmetic mapping of two numeric values from a source to a destination
   * @param sourceField1 a numeric value
   * @param sourceField2 a numeric value
   * @param to a numeric value
   * @returns an IMapping instance
   */
  private static arithmetic(sourceField1: Field, sourceField2: Field, to: Field, operation: string) {

    if (!to.dataType) {
      throw new Error('dataType for \'to\' required');
    }

    const tmpField = `${sourceField1.name},${sourceField2.name}`;
    return new Mapping([
      new Task(TT_ARITHMETIC, [sourceField1.name, sourceField2.name], { operation: operation }, [{
        key: 'MATH_OPERATION_FIELDS_ORDER', value: tmpField,
      }], tmpField),
      new Task(TT_MAP, [tmpField], { operation: OP_NOOP }, [
        { key: 'DESTINATION_DATA_TYPE', value: to.dataType },
        { key: 'SOURCE_DATA_TYPE', value: 'string' },
      ],
      to.name),
    ]);
  }

}
