import { structure } from "../ssot/structure.js";
import type { TableKey } from "../types/types.js";

function getPkFields(tableKey: TableKey): string[] {
  const tableConfig = structure.tables[tableKey];
  return Array.isArray(tableConfig.pk) ? tableConfig.pk : [tableConfig.pk];
}
