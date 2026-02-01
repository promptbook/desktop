import { ipcMain } from 'electron';
import { kernelService } from '../services/KernelService';

/**
 * Execute a DataFrame operation via Python kernel
 */
async function executeDataFrameOperation(
  operation: string,
  args: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const argsJson = JSON.stringify(args);
  const code = `
import json
from dataframe_operations import ${operation}
result = ${operation}(**json.loads('${argsJson.replace(/'/g, "\\'")}'))
print(json.dumps(result))
`;

  try {
    const result = await kernelService.execute(code);
    if (result.success && result.outputs) {
      // Find stdout output containing JSON result
      const stdoutOutput = result.outputs.find(o => o.type === 'stdout');
      if (stdoutOutput) {
        const parsed = JSON.parse(stdoutOutput.content.trim());
        return { success: true, data: parsed };
      }
    }
    return { success: false, error: result.error || 'Execution failed' };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Register DataFrame-related IPC handlers
 */
export function registerDataFrameHandlers(): void {
  // Get a page of DataFrame data
  ipcMain.handle(
    'dataframe:getPage',
    async (_event, dfId: string, page: number, pageSize: number) => {
      return executeDataFrameOperation('get_page', {
        df_id: dfId,
        page,
        page_size: pageSize,
      });
    }
  );

  // Edit a cell
  ipcMain.handle(
    'dataframe:editCell',
    async (_event, dfId: string, rowIndex: number, column: string, value: unknown) => {
      return executeDataFrameOperation('edit_cell', {
        df_id: dfId,
        row_index: rowIndex,
        column,
        value,
      });
    }
  );

  // Add a row
  ipcMain.handle(
    'dataframe:addRow',
    async (_event, dfId: string, rowData?: Record<string, unknown>) => {
      return executeDataFrameOperation('add_row', {
        df_id: dfId,
        row_data: rowData,
      });
    }
  );

  // Delete a row
  ipcMain.handle(
    'dataframe:deleteRow',
    async (_event, dfId: string, rowIndex: number) => {
      return executeDataFrameOperation('delete_row', {
        df_id: dfId,
        row_index: rowIndex,
      });
    }
  );

  // Add a column
  ipcMain.handle(
    'dataframe:addColumn',
    async (
      _event,
      dfId: string,
      column: string,
      dtype: string,
      defaultValue?: unknown
    ) => {
      return executeDataFrameOperation('add_column', {
        df_id: dfId,
        column,
        dtype,
        default_value: defaultValue,
      });
    }
  );

  // Delete a column
  ipcMain.handle(
    'dataframe:deleteColumn',
    async (_event, dfId: string, column: string) => {
      return executeDataFrameOperation('delete_column', {
        df_id: dfId,
        column,
      });
    }
  );

  // Rename a column
  ipcMain.handle(
    'dataframe:renameColumn',
    async (_event, dfId: string, column: string, newName: string) => {
      return executeDataFrameOperation('rename_column', {
        df_id: dfId,
        column,
        new_name: newName,
      });
    }
  );

  // Change column type
  ipcMain.handle(
    'dataframe:changeColumnType',
    async (_event, dfId: string, column: string, newType: string) => {
      return executeDataFrameOperation('change_column_type', {
        df_id: dfId,
        column,
        new_type: newType,
      });
    }
  );

  // Cleanup old DataFrames
  ipcMain.handle(
    'dataframe:cleanup',
    async (_event, maxAgeMinutes?: number) => {
      return executeDataFrameOperation('cleanup_registry', {
        max_age_minutes: maxAgeMinutes || 60,
      });
    }
  );
}
