import { Transaction } from 'sequelize';
import sequelize from '../index';
import { RepositoryError } from './BaseRepository';

// Transaction isolation levels
export enum IsolationLevel {
  READ_UNCOMMITTED = 'READ UNCOMMITTED',
  READ_COMMITTED = 'READ COMMITTED',
  REPEATABLE_READ = 'REPEATABLE READ',
  SERIALIZABLE = 'SERIALIZABLE'
}

// Transaction options interface
export interface TransactionOptions {
  isolationLevel?: IsolationLevel;
  readOnly?: boolean;
  deferrable?: boolean;
  timeout?: number;
}

// Transaction result interface
export interface TransactionResult<T> {
  success: boolean;
  result?: T;
  error?: RepositoryError;
  executionTime: number;
}

// Transaction callback type
export type TransactionCallback<T> = (transaction: Transaction) => Promise<T>;

// Retry policy interface
export interface RetryPolicy {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

// Default retry policy
const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelay: 100,
  maxDelay: 5000,
  backoffMultiplier: 2,
  retryableErrors: [
    'SequelizeConnectionError',
    'SequelizeConnectionTimedOutError',
    'SequelizeTimeoutError',
    'SequelizeUniqueConstraintError'
  ]
};

// Transaction statistics
export interface TransactionStats {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  averageExecutionTime: number;
  retryCount: number;
  lastError?: string;
}

/**
 * Advanced transaction manager with retry logic, error handling, and monitoring
 */
export class TransactionManager {
  private stats: TransactionStats = {
    totalTransactions: 0,
    successfulTransactions: 0,
    failedTransactions: 0,
    averageExecutionTime: 0,
    retryCount: 0
  };

  private executionTimes: number[] = [];
  private maxStatsHistory = 1000;

  /**
   * Execute a callback within a transaction with automatic retry and error handling
   */
  async executeInTransaction<T>(
    callback: TransactionCallback<T>,
    options?: TransactionOptions,
    retryPolicy: RetryPolicy = DEFAULT_RETRY_POLICY
  ): Promise<TransactionResult<T>> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    let retryCount = 0;

    this.stats.totalTransactions++;

    for (let attempt = 0; attempt <= retryPolicy.maxRetries; attempt++) {
      let transaction: Transaction | null = null;

      try {
        // Start transaction with options
        transaction = await this.startTransaction(options);

        // Execute callback
        const result = await callback(transaction);

        // Commit transaction
        await transaction.commit();

        // Record success
        const executionTime = Date.now() - startTime;
        this.recordSuccess(executionTime, retryCount);

        return {
          success: true,
          result,
          executionTime
        };

      } catch (error) {
        lastError = error as Error;
        
        // Rollback transaction if it exists
        if (transaction) {
          try {
            await transaction.rollback();
          } catch (rollbackError) {
            console.error('Failed to rollback transaction:', rollbackError);
          }
        }

        // Check if error is retryable
        if (attempt < retryPolicy.maxRetries && this.isRetryableError(error as Error, retryPolicy)) {
          retryCount++;
          this.stats.retryCount++;
          
          // Calculate delay with exponential backoff
          const delay = Math.min(
            retryPolicy.baseDelay * Math.pow(retryPolicy.backoffMultiplier, attempt),
            retryPolicy.maxDelay
          );
          
          console.warn(`Transaction failed, retrying in ${delay}ms (attempt ${attempt + 1}/${retryPolicy.maxRetries + 1}):`, error);
          await this.sleep(delay);
          continue;
        }

        // Max retries exceeded or non-retryable error
        break;
      }
    }

    // Record failure
    const executionTime = Date.now() - startTime;
    const repositoryError = this.createRepositoryError(lastError!, retryCount);
    this.recordFailure(executionTime, repositoryError);

    return {
      success: false,
      error: repositoryError,
      executionTime
    };
  }

  /**
   * Execute multiple operations in a single transaction
   */
  async executeBatch<T>(
    operations: Array<(transaction: Transaction) => Promise<T>>,
    options?: TransactionOptions,
    retryPolicy: RetryPolicy = DEFAULT_RETRY_POLICY
  ): Promise<TransactionResult<T[]>> {
    return this.executeInTransaction(async (transaction) => {
      const results: T[] = [];
      
      for (const operation of operations) {
        const result = await operation(transaction);
        results.push(result);
      }
      
      return results;
    }, options, retryPolicy);
  }

  /**
   * Execute operations with savepoints for partial rollback
   */
  async executeWithSavepoints<T>(
    operations: Array<{
      name: string;
      operation: (transaction: Transaction) => Promise<T>;
    }>,
    options?: TransactionOptions
  ): Promise<TransactionResult<Record<string, T>>> {
    return this.executeInTransaction(async (transaction) => {
      const results: Record<string, T> = {};
      
      for (const { name, operation } of operations) {
        const savepointName = `sp_${name}_${Date.now()}`;
        
        try {
          // Create savepoint using sequelize instance
          await sequelize.query(`SAVEPOINT ${savepointName}`, { transaction });
          
          // Execute operation
          const result = await operation(transaction);
          results[name] = result;
          
          // Release savepoint
          await sequelize.query(`RELEASE SAVEPOINT ${savepointName}`, { transaction });
          
        } catch (error) {
          // Rollback to savepoint
          await sequelize.query(`ROLLBACK TO SAVEPOINT ${savepointName}`, { transaction });
          throw new RepositoryError(
            `Operation '${name}' failed: ${(error as Error).message}`,
            'SAVEPOINT_ROLLBACK',
            error as Error
          );
        }
      }
      
      return results;
    }, options);
  }

  /**
   * Start a new transaction with options
   */
  private async startTransaction(options?: TransactionOptions): Promise<Transaction> {
    const transactionOptions: any = {};

    if (options?.isolationLevel) {
      transactionOptions.isolationLevel = options.isolationLevel;
    }

    if (options?.readOnly) {
      transactionOptions.readOnly = options.readOnly;
    }

    if (options?.deferrable) {
      transactionOptions.deferrable = options.deferrable;
    }

    return await sequelize.transaction(transactionOptions);
  }

  /**
   * Check if an error is retryable based on policy
   */
  private isRetryableError(error: Error, policy: RetryPolicy): boolean {
    return policy.retryableErrors.some(retryableError => 
      error.constructor.name === retryableError ||
      error.message.includes(retryableError)
    );
  }

  /**
   * Create a repository error from the original error
   */
  private createRepositoryError(error: Error, retryCount: number): RepositoryError {
    let code = 'TRANSACTION_ERROR';
    
    if (error.constructor.name.includes('Timeout')) {
      code = 'TRANSACTION_TIMEOUT';
    } else if (error.constructor.name.includes('Connection')) {
      code = 'CONNECTION_ERROR';
    } else if (error.constructor.name.includes('Constraint')) {
      code = 'CONSTRAINT_VIOLATION';
    }

    const message = retryCount > 0 
      ? `Transaction failed after ${retryCount} retries: ${error.message}`
      : `Transaction failed: ${error.message}`;

    return new RepositoryError(message, code, error);
  }

  /**
   * Record successful transaction
   */
  private recordSuccess(executionTime: number, retryCount: number): void {
    this.stats.successfulTransactions++;
    this.recordExecutionTime(executionTime);
    
    if (retryCount > 0) {
      console.info(`Transaction succeeded after ${retryCount} retries`);
    }
  }

  /**
   * Record failed transaction
   */
  private recordFailure(executionTime: number, error: RepositoryError): void {
    this.stats.failedTransactions++;
    this.stats.lastError = error.message;
    this.recordExecutionTime(executionTime);
    
    console.error('Transaction failed:', error);
  }

  /**
   * Record execution time and update average
   */
  private recordExecutionTime(time: number): void {
    this.executionTimes.push(time);
    
    // Keep only recent execution times
    if (this.executionTimes.length > this.maxStatsHistory) {
      this.executionTimes.shift();
    }
    
    // Update average
    this.stats.averageExecutionTime = 
      this.executionTimes.reduce((sum, time) => sum + time, 0) / this.executionTimes.length;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get transaction statistics
   */
  getStats(): TransactionStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalTransactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      averageExecutionTime: 0,
      retryCount: 0
    };
    this.executionTimes = [];
  }

  /**
   * Get success rate as percentage
   */
  getSuccessRate(): number {
    if (this.stats.totalTransactions === 0) return 0;
    return (this.stats.successfulTransactions / this.stats.totalTransactions) * 100;
  }

  /**
   * Check if transaction manager is healthy
   */
  isHealthy(minSuccessRate: number = 95): boolean {
    const successRate = this.getSuccessRate();
    const hasRecentErrors = this.stats.lastError && 
      this.stats.totalTransactions > 0 && 
      this.stats.failedTransactions / this.stats.totalTransactions > 0.1;

    return successRate >= minSuccessRate && !hasRecentErrors;
  }
}

// Export singleton instance
export const transactionManager = new TransactionManager();

// Export utility functions for common transaction patterns
export class TransactionUtils {
  /**
   * Execute a simple transaction with automatic retry
   */
  static async execute<T>(
    callback: TransactionCallback<T>,
    options?: TransactionOptions
  ): Promise<T> {
    const result = await transactionManager.executeInTransaction(callback, options);
    
    if (!result.success) {
      throw result.error!;
    }
    
    return result.result!;
  }

  /**
   * Execute read-only transaction
   */
  static async executeReadOnly<T>(
    callback: TransactionCallback<T>
  ): Promise<T> {
    return TransactionUtils.execute(callback, { 
      readOnly: true, 
      isolationLevel: IsolationLevel.READ_COMMITTED 
    });
  }

  /**
   * Execute serializable transaction for critical operations
   */
  static async executeSerializable<T>(
    callback: TransactionCallback<T>
  ): Promise<T> {
    return TransactionUtils.execute(callback, { 
      isolationLevel: IsolationLevel.SERIALIZABLE 
    });
  }

  /**
   * Execute batch operations
   */
  static async executeBatch<T>(
    operations: Array<(transaction: Transaction) => Promise<T>>,
    options?: TransactionOptions
  ): Promise<T[]> {
    const result = await transactionManager.executeBatch(operations, options);
    
    if (!result.success) {
      throw result.error!;
    }
    
    return result.result!;
  }
}
