/// <reference path="../types/promptbook.d.ts" />
import type {
  DataFramePageResponse,
  DataFrameOperationResponse,
  DataFrameColumnType,
} from '@promptbook/types';

/**
 * Service for DataFrame operations
 * Provides a clean API for interacting with DataFrames via IPC
 */
export class DataFrameService {
  /**
   * Fetch a page of DataFrame data
   */
  async getPage(
    dfId: string,
    page: number,
    pageSize: number
  ): Promise<DataFramePageResponse> {
    try {
      return await window.promptbook.dataframe.getPage(dfId, page, pageSize);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch page',
      };
    }
  }

  /**
   * Edit a single cell value
   */
  async editCell(
    dfId: string,
    rowIndex: number,
    column: string,
    value: unknown
  ): Promise<DataFrameOperationResponse> {
    try {
      return await window.promptbook.dataframe.editCell(
        dfId,
        rowIndex,
        column,
        value
      );
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to edit cell',
      };
    }
  }

  /**
   * Add a new row to the DataFrame
   */
  async addRow(
    dfId: string,
    rowData?: Record<string, unknown>
  ): Promise<DataFrameOperationResponse> {
    try {
      return await window.promptbook.dataframe.addRow(dfId, rowData);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add row',
      };
    }
  }

  /**
   * Delete a row from the DataFrame
   */
  async deleteRow(
    dfId: string,
    rowIndex: number
  ): Promise<DataFrameOperationResponse> {
    try {
      return await window.promptbook.dataframe.deleteRow(dfId, rowIndex);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete row',
      };
    }
  }

  /**
   * Add a new column to the DataFrame
   */
  async addColumn(
    dfId: string,
    column: string,
    dtype?: DataFrameColumnType,
    defaultValue?: unknown
  ): Promise<DataFrameOperationResponse> {
    try {
      return await window.promptbook.dataframe.addColumn(
        dfId,
        column,
        dtype,
        defaultValue
      );
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add column',
      };
    }
  }

  /**
   * Delete a column from the DataFrame
   */
  async deleteColumn(
    dfId: string,
    column: string
  ): Promise<DataFrameOperationResponse> {
    try {
      return await window.promptbook.dataframe.deleteColumn(dfId, column);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to delete column',
      };
    }
  }

  /**
   * Rename a column in the DataFrame
   */
  async renameColumn(
    dfId: string,
    column: string,
    newName: string
  ): Promise<DataFrameOperationResponse> {
    try {
      return await window.promptbook.dataframe.renameColumn(
        dfId,
        column,
        newName
      );
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to rename column',
      };
    }
  }

  /**
   * Change the data type of a column
   */
  async changeColumnType(
    dfId: string,
    column: string,
    newType: DataFrameColumnType
  ): Promise<DataFrameOperationResponse> {
    try {
      return await window.promptbook.dataframe.changeColumnType(
        dfId,
        column,
        newType
      );
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to change column type',
      };
    }
  }
}

/**
 * Singleton instance of the DataFrame service
 */
export const dataFrameService = new DataFrameService();
