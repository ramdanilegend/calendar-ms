import { Model, ModelCtor, Transaction, WhereOptions, FindOptions, CountOptions } from 'sequelize';
import sequelize from '../index';

// Generic query filter interface
export interface QueryFilter<T = any> {
  where?: WhereOptions<T>;
  limit?: number;
  offset?: number;
  order?: Array<[string, 'ASC' | 'DESC']>;
}

// Generic pagination interface
export interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

// Paginated result interface
export interface PaginatedResult<T> {
  data: T[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

// Repository error types
export class RepositoryError extends Error {
  public readonly code: string;
  public readonly originalError?: Error;

  constructor(message: string, code: string = 'REPOSITORY_ERROR', originalError?: Error) {
    super(message);
    this.name = 'RepositoryError';
    this.code = code;
    this.originalError = originalError;
  }
}

// Base repository interface
export interface IBaseRepository<T extends Model, TAttributes, TCreationAttributes> {
  findById(id: number, transaction?: Transaction): Promise<T | null>;
  findOne(filter: QueryFilter<TAttributes>, transaction?: Transaction): Promise<T | null>;
  findAll(filter?: QueryFilter<TAttributes>, transaction?: Transaction): Promise<T[]>;
  findAndCountAll(filter: QueryFilter<TAttributes>, pagination?: PaginationOptions, transaction?: Transaction): Promise<PaginatedResult<T>>;
  create(data: TCreationAttributes, transaction?: Transaction): Promise<T>;
  update(id: number, data: Partial<TAttributes>, transaction?: Transaction): Promise<T | null>;
  upsert(data: TCreationAttributes & { id?: number }, transaction?: Transaction): Promise<[T, boolean]>;
  delete(id: number, transaction?: Transaction): Promise<boolean>;
  count(filter?: QueryFilter<TAttributes>, transaction?: Transaction): Promise<number>;
  exists(filter: QueryFilter<TAttributes>, transaction?: Transaction): Promise<boolean>;
}

// Base repository implementation
export class BaseRepository<T extends Model, TAttributes, TCreationAttributes> 
  implements IBaseRepository<T, TAttributes, TCreationAttributes> {
  
  protected model: ModelCtor<T>;

  constructor(model: ModelCtor<T>) {
    this.model = model;
  }

  // Start a new database transaction
  async startTransaction(): Promise<Transaction> {
    return await sequelize.transaction();
  }

  // Convert query filter to Sequelize options
  protected buildFindOptions(filter?: QueryFilter<TAttributes>, transaction?: Transaction): FindOptions<TAttributes> {
    const options: FindOptions<TAttributes> = {};
    
    if (filter?.where) {
      options.where = filter.where;
    }
    
    if (filter?.limit) {
      options.limit = filter.limit;
    }
    
    if (filter?.offset) {
      options.offset = filter.offset;
    }
    
    if (filter?.order) {
      options.order = filter.order;
    }
    
    if (transaction) {
      options.transaction = transaction;
    }

    return options;
  }

  // Convert pagination options to limit/offset
  protected buildPaginationOptions(pagination?: PaginationOptions): { limit: number; offset: number } {
    const page = pagination?.page || 1;
    const pageSize = pagination?.pageSize || 10;
    
    return {
      limit: pageSize,
      offset: (page - 1) * pageSize
    };
  }

  // Handle repository errors consistently
  protected handleError(error: Error, operation: string): never {
    console.error(`Repository error during ${operation}:`, error);
    
    if (error instanceof RepositoryError) {
      throw error;
    }
    
    throw new RepositoryError(
      `Failed to ${operation}: ${error.message}`,
      'DATABASE_ERROR',
      error
    );
  }

  // Basic CRUD operations
  async findById(id: number, transaction?: Transaction): Promise<T | null> {
    try {
      return await this.model.findByPk(id, { transaction });
    } catch (error) {
      this.handleError(error as Error, 'find by ID');
    }
  }

  async findOne(filter: QueryFilter<TAttributes>, transaction?: Transaction): Promise<T | null> {
    try {
      const options = this.buildFindOptions(filter, transaction);
      return await this.model.findOne(options);
    } catch (error) {
      this.handleError(error as Error, 'find one');
    }
  }

  async findAll(filter?: QueryFilter<TAttributes>, transaction?: Transaction): Promise<T[]> {
    try {
      const options = this.buildFindOptions(filter, transaction);
      return await this.model.findAll(options);
    } catch (error) {
      this.handleError(error as Error, 'find all');
    }
  }

  async findAndCountAll(
    filter: QueryFilter<TAttributes>, 
    pagination?: PaginationOptions, 
    transaction?: Transaction
  ): Promise<PaginatedResult<T>> {
    try {
      const paginationOpts = this.buildPaginationOptions(pagination);
      const options = this.buildFindOptions(filter, transaction);
      
      // Apply pagination
      options.limit = paginationOpts.limit;
      options.offset = paginationOpts.offset;

      const { count, rows } = await this.model.findAndCountAll(options);
      
      const currentPage = pagination?.page || 1;
      const pageSize = pagination?.pageSize || 10;
      
      return {
        data: rows,
        totalCount: count,
        totalPages: Math.ceil(count / pageSize),
        currentPage,
        pageSize
      };
    } catch (error) {
      this.handleError(error as Error, 'find and count all');
    }
  }

  async create(data: TCreationAttributes, transaction?: Transaction): Promise<T> {
    try {
      return await this.model.create(data as any, { transaction });
    } catch (error) {
      this.handleError(error as Error, 'create');
    }
  }

  async update(id: number, data: Partial<TAttributes>, transaction?: Transaction): Promise<T | null> {
    try {
      const [affectedCount] = await this.model.update(data as any, {
        where: { id } as any,
        transaction
      });
      
      if (affectedCount === 0) {
        return null;
      }
      
      return await this.findById(id, transaction);
    } catch (error) {
      this.handleError(error as Error, 'update');
    }
  }

  async upsert(data: TCreationAttributes & { id?: number }, transaction?: Transaction): Promise<[T, boolean]> {
    try {
      const [instance, created] = await this.model.upsert(data as any, { transaction });
      return [instance, created || false];
    } catch (error) {
      this.handleError(error as Error, 'upsert');
    }
  }

  async delete(id: number, transaction?: Transaction): Promise<boolean> {
    try {
      const deletedCount = await this.model.destroy({
        where: { id } as any,
        transaction
      });
      
      return deletedCount > 0;
    } catch (error) {
      this.handleError(error as Error, 'delete');
    }
  }

  async count(filter?: QueryFilter<TAttributes>, transaction?: Transaction): Promise<number> {
    try {
      const options: CountOptions<TAttributes> = {};
      
      if (filter?.where) {
        options.where = filter.where;
      }
      
      if (transaction) {
        options.transaction = transaction;
      }

      return await this.model.count(options);
    } catch (error) {
      this.handleError(error as Error, 'count');
    }
  }

  async exists(filter: QueryFilter<TAttributes>, transaction?: Transaction): Promise<boolean> {
    try {
      const count = await this.count(filter, transaction);
      return count > 0;
    } catch (error) {
      this.handleError(error as Error, 'check existence');
    }
  }

  // Batch operations
  async createMany(data: TCreationAttributes[], transaction?: Transaction): Promise<T[]> {
    try {
      return await this.model.bulkCreate(data as any[], { transaction });
    } catch (error) {
      this.handleError(error as Error, 'create many');
    }
  }

  async updateMany(
    filter: QueryFilter<TAttributes>, 
    data: Partial<TAttributes>, 
    transaction?: Transaction
  ): Promise<number> {
    try {
      const [affectedCount] = await this.model.update(data as any, {
        where: filter.where as any,
        transaction
      });
      
      return affectedCount;
    } catch (error) {
      this.handleError(error as Error, 'update many');
    }
  }

  async deleteMany(filter: QueryFilter<TAttributes>, transaction?: Transaction): Promise<number> {
    try {
      return await this.model.destroy({
        where: filter.where as any,
        transaction
      });
    } catch (error) {
      this.handleError(error as Error, 'delete many');
    }
  }
}
