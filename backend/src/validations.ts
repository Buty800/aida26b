import { getRequiredFields } from './helpers';
import { getPkFields } from '../../shared/src/utils/utils';
import { TableKey    } from '../../shared/src/types/types';
import { structure   } from '../../shared/src/ssot/structure';

function incorrectAmountOfPKParameters(pks: string[], tableName: string) {
  return pks.length !== 0 && pks.length !== getPkFields(tableName as TableKey).length;
}

function isValidTable(tableName: string) : boolean{
  return Object.keys(structure.tables).includes(tableName); 
}

function invalidPKFieldNames(table: TableKey, fieldNames: string[]){
  return getPkFields(table) === fieldNames;
}

function invalidFieldNames(table: TableKey, fieldNames: string[]){
  return Object.keys(structure.tables[table].columns) === fieldNames 
}

function notTryingToModifyDerivableValue(fieldsToModify: string[], notDerivableFields: string[]): boolean{
  return fieldsToModify.every(field => notDerivableFields.includes(field));
}

function requiredFieldsEnoughValuesForRequiredFields(tableName: TableKey, amountOfValuesProvided: number): boolean{
  return getRequiredFields(tableName).length === amountOfValuesProvided;
}

export { incorrectAmountOfPKParameters, isValidTable, invalidPKFieldNames, invalidFieldNames, notTryingToModifyDerivableValue, requiredFieldsEnoughValuesForRequiredFields };