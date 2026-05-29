import { isValidTable, incorrectAmountOfPKParameters, invalidPKFieldNames, invalidFieldNames, notTryingToModifyDerivableValue, requiredFieldsEnoughValuesForRequiredFields } from './validations';
import { sendNotFoundMessage, sendInvalidInstanceMessage } from './status_messages';
import { TableKey } from '../../shared/src/types/types';
import { getNotDerivableFields } from './helpers';
import   express  from 'express';

function assertValidPutInstance(tableName: string, res: express.Response, pksValues: string[], entityName: string, fieldNames: string[], newValues: any[], pkFieldsNames: string[]){
  if (!isValidTable(tableName)){
    sendNotFoundMessage(res, `Invalid table`);
    return false;
  }
  if (incorrectAmountOfPKParameters(pksValues, tableName)){
    sendInvalidInstanceMessage(res, `Insufficient amount of fields to identify a/an ${entityName}`);
    return false;
  } 
  if (invalidPKFieldNames(tableName as TableKey, pkFieldsNames)){
    sendInvalidInstanceMessage(res, `Invalid fields to identify a/an ${entityName}`);
    return false;
  }
  if (invalidFieldNames(tableName as TableKey, fieldNames)){
    sendInvalidInstanceMessage(res, `Invalid fields to modify`);
    return false;
  }
  if (!notTryingToModifyDerivableValue(pkFieldsNames, getNotDerivableFields(tableName as TableKey))){
    sendInvalidInstanceMessage(res, `Cant modify derivable fields`);
    return false;
  } 
  if (requiredFieldsEnoughValuesForRequiredFields(tableName as TableKey, newValues.length)){
    sendInvalidInstanceMessage(res, `Need to provide values for, at least, al required ${entityName} fields`);
    return false;
  }
  return true;
}

function assertValidDeleteInstance(tableName: string, res: express.Response, pkFieldsNames: string[], entityName: string){
  if (!isValidTable(tableName)){
    sendNotFoundMessage(res, `Invalid table`);
    return false;
  }
  if (incorrectAmountOfPKParameters(pkFieldsNames, tableName)){
    sendInvalidInstanceMessage(res, `Insufficient amount of fields to identify a/an ${entityName}`);
    return false;
  }
  if (invalidPKFieldNames(tableName as TableKey, pkFieldsNames)){
    sendInvalidInstanceMessage(res, `Invalid fields to identify a/an ${entityName}`);
    return false;
  }
  return true;
}

export { assertValidDeleteInstance, assertValidPutInstance };
