import { Transaction, Op, WhereOptions } from 'sequelize';
import { BaseRepository, QueryFilter, RepositoryError } from './BaseRepository';
import UpdateMetadata from '../models/UpdateMetadata';

// UpdateMetadata-specific interfaces
export interface UpdateMetadataAttributes {
  id: number;
  source: string;
  region: string;
  last_successful_update: Date;
  status: string;
  error_details: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface UpdateMetadataCreationAttributes {
  source: string;
  region: string;
  last_successful_update: Date;
  status?: string;
  error_details?: string | null;
}

// Query filters for update metadata
export interface UpdateMetadataQueryFilter extends QueryFilter<UpdateMetadataAttributes> {
  source?: string;
  region?: string;
  status?: string;
  sources?: string[];
  regions?: string[];
  statuses?: string[];
  updated_since?: Date;
  updated_before?: Date;
  has_errors?: boolean;
}

// Update operation result
export interface UpdateOperationResult {
  success: boolean;
  updated_at: Date;
  error?: string;
  metadata: UpdateMetadata;
}

// Batch update result
export interface BatchUpdateResult {
  successful: UpdateOperationResult[];
  failed: {
    source: string;
    region: string;
    error: string;
  }[];
  totalProcessed: number;
}

// Update statistics
export interface UpdateStatistics {
  totalSources: number;
  totalRegions: number;
  byStatus: Record<string, number>;
  bySource: Record<string, { total: number; byStatus: Record<string, number> }>;
  byRegion: Record<string, { total: number; byStatus: Record<string, number> }>;
  lastUpdateTimes: {
    source: string;
    region: string;
    last_successful_update: Date;
    status: string;
  }[];
}

// Update metadata repository interface
export interface IUpdateMetadataRepository {
  // Basic CRUD operations
  findUpdateMetadataById(id: number, transaction?: Transaction): Promise<UpdateMetadata | null>;
  findUpdateMetadataBySourceAndRegion(source: string, region: string, transaction?: Transaction): Promise<UpdateMetadata | null>;
  findUpdateMetadataBySource(source: string, filter?: UpdateMetadataQueryFilter, transaction?: Transaction): Promise<UpdateMetadata[]>;
  findUpdateMetadataByRegion(region: string, filter?: UpdateMetadataQueryFilter, transaction?: Transaction): Promise<UpdateMetadata[]>;
  findUpdateMetadataByStatus(status: string, filter?: UpdateMetadataQueryFilter, transaction?: Transaction): Promise<UpdateMetadata[]>;
  createUpdateMetadata(data: UpdateMetadataCreationAttributes, transaction?: Transaction): Promise<UpdateMetadata>;
  updateUpdateMetadata(id: number, data: Partial<UpdateMetadataAttributes>, transaction?: Transaction): Promise<UpdateMetadata | null>;
  upsertUpdateMetadata(data: UpdateMetadataCreationAttributes & { id?: number }, transaction?: Transaction): Promise<[UpdateMetadata, boolean]>;
  deleteUpdateMetadata(id: number, transaction?: Transaction): Promise<boolean>;

  // Update operation tracking
  recordSuccessfulUpdate(source: string, region: string, timestamp?: Date, transaction?: Transaction): Promise<UpdateOperationResult>;
  recordFailedUpdate(source: string, region: string, errorDetails: string, timestamp?: Date, transaction?: Transaction): Promise<UpdateOperationResult>;
  recordUpdateInProgress(source: string, region: string, timestamp?: Date, transaction?: Transaction): Promise<UpdateOperationResult>;

  // Query operations
  findStaleUpdates(maxAgeHours: number, filter?: UpdateMetadataQueryFilter, transaction?: Transaction): Promise<UpdateMetadata[]>;
  findFailedUpdates(filter?: UpdateMetadataQueryFilter, transaction?: Transaction): Promise<UpdateMetadata[]>;
  findUpdatesInProgress(filter?: UpdateMetadataQueryFilter, transaction?: Transaction): Promise<UpdateMetadata[]>;
  findRecentUpdates(hoursBack: number, filter?: UpdateMetadataQueryFilter, transaction?: Transaction): Promise<UpdateMetadata[]>;

  // Batch operations
  batchRecordUpdates(updates: { source: string; region: string; success: boolean; errorDetails?: string; timestamp?: Date }[], transaction?: Transaction): Promise<BatchUpdateResult>;
  resetFailedUpdates(sources?: string[], regions?: string[], transaction?: Transaction): Promise<number>;
  cleanupOldUpdateRecords(daysToKeep: number, transaction?: Transaction): Promise<number>;

  // Analytics and monitoring
  getUpdateStatistics(filter?: UpdateMetadataQueryFilter, transaction?: Transaction): Promise<UpdateStatistics>;
  getSourceHealthStatus(source: string, hoursBack?: number, transaction?: Transaction): Promise<{ source: string; healthy: boolean; lastSuccess?: Date; failureRate: number; regions: { region: string; status: string; last_update: Date }[] }>;
  getRegionHealthStatus(region: string, hoursBack?: number, transaction?: Transaction): Promise<{ region: string; healthy: boolean; lastSuccess?: Date; failureRate: number; sources: { source: string; status: string; last_update: Date }[] }>;
  getOverallSystemHealth(hoursBack?: number, transaction?: Transaction): Promise<{ healthy: boolean; totalSources: number; totalRegions: number; successRate: number; activeFailures: number }>;
}

// Update metadata repository implementation
export class UpdateMetadataRepository implements IUpdateMetadataRepository {
  private updateMetadataRepo: BaseRepository<UpdateMetadata, UpdateMetadataAttributes, UpdateMetadataCreationAttributes>;

  constructor() {
    this.updateMetadataRepo = new BaseRepository<UpdateMetadata, UpdateMetadataAttributes, UpdateMetadataCreationAttributes>(UpdateMetadata);
  }

  // Helper method to build where clause from filter
  private buildWhereClause(filter?: UpdateMetadataQueryFilter): WhereOptions<UpdateMetadataAttributes> {
    const whereClause: any = {};

    if (filter?.source) {
      whereClause.source = filter.source;
    }

    if (filter?.region) {
      whereClause.region = filter.region;
    }

    if (filter?.status) {
      whereClause.status = filter.status;
    }

    if (filter?.sources && filter.sources.length > 0) {
      whereClause.source = {
        [Op.in]: filter.sources
      };
    }

    if (filter?.regions && filter.regions.length > 0) {
      whereClause.region = {
        [Op.in]: filter.regions
      };
    }

    if (filter?.statuses && filter.statuses.length > 0) {
      whereClause.status = {
        [Op.in]: filter.statuses
      };
    }

    if (filter?.updated_since) {
      whereClause.last_successful_update = {
        [Op.gte]: filter.updated_since
      };
    }

    if (filter?.updated_before) {
      whereClause.last_successful_update = {
        ...(whereClause.last_successful_update || {}),
        [Op.lte]: filter.updated_before
      };
    }

    if (filter?.has_errors !== undefined) {
      if (filter.has_errors) {
        whereClause.error_details = {
          [Op.ne]: null
        };
      } else {
        whereClause.error_details = null;
      }
    }

    return whereClause;
  }

  // Basic CRUD operations
  async findUpdateMetadataById(id: number, transaction?: Transaction): Promise<UpdateMetadata | null> {
    return await this.updateMetadataRepo.findById(id, transaction);
  }

  async findUpdateMetadataBySourceAndRegion(source: string, region: string, transaction?: Transaction): Promise<UpdateMetadata | null> {
    return await this.updateMetadataRepo.findOne({
      where: { source, region }
    }, transaction);
  }

  async findUpdateMetadataBySource(source: string, filter?: UpdateMetadataQueryFilter, transaction?: Transaction): Promise<UpdateMetadata[]> {
    const whereClause = this.buildWhereClause(filter);
    (whereClause as any).source = source;

    return await this.updateMetadataRepo.findAll({
      where: whereClause,
      limit: filter?.limit,
      offset: filter?.offset,
      order: filter?.order || [['last_successful_update', 'DESC']]
    }, transaction);
  }

  async findUpdateMetadataByRegion(region: string, filter?: UpdateMetadataQueryFilter, transaction?: Transaction): Promise<UpdateMetadata[]> {
    const whereClause = this.buildWhereClause(filter);
    (whereClause as any).region = region;

    return await this.updateMetadataRepo.findAll({
      where: whereClause,
      limit: filter?.limit,
      offset: filter?.offset,
      order: filter?.order || [['last_successful_update', 'DESC']]
    }, transaction);
  }

  async findUpdateMetadataByStatus(status: string, filter?: UpdateMetadataQueryFilter, transaction?: Transaction): Promise<UpdateMetadata[]> {
    const whereClause = this.buildWhereClause(filter);
    (whereClause as any).status = status;

    return await this.updateMetadataRepo.findAll({
      where: whereClause,
      limit: filter?.limit,
      offset: filter?.offset,
      order: filter?.order || [['last_successful_update', 'DESC']]
    }, transaction);
  }

  async createUpdateMetadata(data: UpdateMetadataCreationAttributes, transaction?: Transaction): Promise<UpdateMetadata> {
    return await this.updateMetadataRepo.create(data, transaction);
  }

  async updateUpdateMetadata(id: number, data: Partial<UpdateMetadataAttributes>, transaction?: Transaction): Promise<UpdateMetadata | null> {
    return await this.updateMetadataRepo.update(id, data, transaction);
  }

  async upsertUpdateMetadata(data: UpdateMetadataCreationAttributes & { id?: number }, transaction?: Transaction): Promise<[UpdateMetadata, boolean]> {
    return await this.updateMetadataRepo.upsert(data, transaction);
  }

  async deleteUpdateMetadata(id: number, transaction?: Transaction): Promise<boolean> {
    return await this.updateMetadataRepo.delete(id, transaction);
  }

  // Update operation tracking
  async recordSuccessfulUpdate(source: string, region: string, timestamp?: Date, transaction?: Transaction): Promise<UpdateOperationResult> {
    const updateTime = timestamp || new Date();
    
    try {
      const [metadata] = await this.upsertUpdateMetadata({
        source,
        region,
        last_successful_update: updateTime,
        status: 'success',
        error_details: null
      }, transaction);

      return {
        success: true,
        updated_at: updateTime,
        metadata
      };
    } catch (error) {
      throw new RepositoryError(
        `Failed to record successful update for ${source}/${region}: ${(error as Error).message}`,
        'UPDATE_TRACKING_ERROR',
        error as Error
      );
    }
  }

  async recordFailedUpdate(source: string, region: string, errorDetails: string, timestamp?: Date, transaction?: Transaction): Promise<UpdateOperationResult> {
    const updateTime = timestamp || new Date();
    
    try {
      const existingMetadata = await this.findUpdateMetadataBySourceAndRegion(source, region, transaction);
      
      const [metadata] = await this.upsertUpdateMetadata({
        source,
        region,
        last_successful_update: existingMetadata?.last_successful_update || updateTime,
        status: 'failed',
        error_details: errorDetails
      }, transaction);

      return {
        success: false,
        updated_at: updateTime,
        error: errorDetails,
        metadata
      };
    } catch (error) {
      throw new RepositoryError(
        `Failed to record failed update for ${source}/${region}: ${(error as Error).message}`,
        'UPDATE_TRACKING_ERROR',
        error as Error
      );
    }
  }

  async recordUpdateInProgress(source: string, region: string, timestamp?: Date, transaction?: Transaction): Promise<UpdateOperationResult> {
    const updateTime = timestamp || new Date();
    
    try {
      const existingMetadata = await this.findUpdateMetadataBySourceAndRegion(source, region, transaction);
      
      const [metadata] = await this.upsertUpdateMetadata({
        source,
        region,
        last_successful_update: existingMetadata?.last_successful_update || updateTime,
        status: 'in_progress',
        error_details: null
      }, transaction);

      return {
        success: true,
        updated_at: updateTime,
        metadata
      };
    } catch (error) {
      throw new RepositoryError(
        `Failed to record update in progress for ${source}/${region}: ${(error as Error).message}`,
        'UPDATE_TRACKING_ERROR',
        error as Error
      );
    }
  }

  // Query operations
  async findStaleUpdates(maxAgeHours: number, filter?: UpdateMetadataQueryFilter, transaction?: Transaction): Promise<UpdateMetadata[]> {
    const staleThreshold = new Date();
    staleThreshold.setHours(staleThreshold.getHours() - maxAgeHours);

    const whereClause = this.buildWhereClause(filter);
    (whereClause as any).last_successful_update = {
      [Op.lt]: staleThreshold
    };

    return await this.updateMetadataRepo.findAll({
      where: whereClause,
      order: [['last_successful_update', 'ASC']]
    }, transaction);
  }

  async findFailedUpdates(filter?: UpdateMetadataQueryFilter, transaction?: Transaction): Promise<UpdateMetadata[]> {
    return await this.findUpdateMetadataByStatus('failed', filter, transaction);
  }

  async findUpdatesInProgress(filter?: UpdateMetadataQueryFilter, transaction?: Transaction): Promise<UpdateMetadata[]> {
    return await this.findUpdateMetadataByStatus('in_progress', filter, transaction);
  }

  async findRecentUpdates(hoursBack: number, filter?: UpdateMetadataQueryFilter, transaction?: Transaction): Promise<UpdateMetadata[]> {
    const recentThreshold = new Date();
    recentThreshold.setHours(recentThreshold.getHours() - hoursBack);

    const whereClause = this.buildWhereClause(filter);
    (whereClause as any).last_successful_update = {
      [Op.gte]: recentThreshold
    };

    return await this.updateMetadataRepo.findAll({
      where: whereClause,
      order: [['last_successful_update', 'DESC']]
    }, transaction);
  }

  // Batch operations
  async batchRecordUpdates(
    updates: { source: string; region: string; success: boolean; errorDetails?: string; timestamp?: Date }[], 
    transaction?: Transaction
  ): Promise<BatchUpdateResult> {
    const successful: UpdateOperationResult[] = [];
    const failed: { source: string; region: string; error: string }[] = [];
    
    const useTransaction = transaction || await this.updateMetadataRepo.startTransaction();
    let shouldCommit = false;

    if (!transaction) {
      shouldCommit = true;
    }

    try {
      for (const update of updates) {
        try {
          let result: UpdateOperationResult;
          
          if (update.success) {
            result = await this.recordSuccessfulUpdate(update.source, update.region, update.timestamp, useTransaction);
          } else {
            result = await this.recordFailedUpdate(update.source, update.region, update.errorDetails || 'Unknown error', update.timestamp, useTransaction);
          }
          
          successful.push(result);
        } catch (error) {
          failed.push({
            source: update.source,
            region: update.region,
            error: (error as Error).message
          });
        }
      }

      if (shouldCommit) {
        await useTransaction.commit();
      }

      return {
        successful,
        failed,
        totalProcessed: updates.length
      };
    } catch (error) {
      if (shouldCommit) {
        await useTransaction.rollback();
      }
      throw error;
    }
  }

  async resetFailedUpdates(sources?: string[], regions?: string[], transaction?: Transaction): Promise<number> {
    const whereClause: WhereOptions<UpdateMetadataAttributes> = {
      status: 'failed'
    };

    if (sources && sources.length > 0) {
      whereClause.source = { [Op.in]: sources };
    }

    if (regions && regions.length > 0) {
      whereClause.region = { [Op.in]: regions };
    }

    return await this.updateMetadataRepo.updateMany({
      where: whereClause
    }, {
      status: 'success',
      error_details: null
    }, transaction);
  }

  async cleanupOldUpdateRecords(daysToKeep: number, transaction?: Transaction): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    return await this.updateMetadataRepo.deleteMany({
      where: {
        updated_at: {
          [Op.lt]: cutoffDate
        }
      }
    }, transaction);
  }

  // Analytics and monitoring
  async getUpdateStatistics(filter?: UpdateMetadataQueryFilter, transaction?: Transaction): Promise<UpdateStatistics> {
    try {
      const whereClause = this.buildWhereClause(filter);
      const allRecords = await this.updateMetadataRepo.findAll({
        where: whereClause
      }, transaction);

      const stats: UpdateStatistics = {
        totalSources: 0,
        totalRegions: 0,
        byStatus: {},
        bySource: {},
        byRegion: {},
        lastUpdateTimes: []
      };

      const uniqueSources = new Set<string>();
      const uniqueRegions = new Set<string>();

      for (const record of allRecords) {
        uniqueSources.add(record.source);
        uniqueRegions.add(record.region);

        // Count by status
        stats.byStatus[record.status] = (stats.byStatus[record.status] || 0) + 1;

        // Count by source
        if (!stats.bySource[record.source]) {
          stats.bySource[record.source] = { total: 0, byStatus: {} };
        }
        stats.bySource[record.source].total += 1;
        stats.bySource[record.source].byStatus[record.status] = (stats.bySource[record.source].byStatus[record.status] || 0) + 1;

        // Count by region
        if (!stats.byRegion[record.region]) {
          stats.byRegion[record.region] = { total: 0, byStatus: {} };
        }
        stats.byRegion[record.region].total += 1;
        stats.byRegion[record.region].byStatus[record.status] = (stats.byRegion[record.region].byStatus[record.status] || 0) + 1;

        // Collect last update times
        stats.lastUpdateTimes.push({
          source: record.source,
          region: record.region,
          last_successful_update: record.last_successful_update,
          status: record.status
        });
      }

      stats.totalSources = uniqueSources.size;
      stats.totalRegions = uniqueRegions.size;
      stats.lastUpdateTimes.sort((a, b) => b.last_successful_update.getTime() - a.last_successful_update.getTime());

      return stats;
    } catch (error) {
      throw new RepositoryError(
        `Failed to get update statistics: ${(error as Error).message}`,
        'ANALYTICS_ERROR',
        error as Error
      );
    }
  }

  async getSourceHealthStatus(source: string, hoursBack: number = 24, transaction?: Transaction): Promise<{ source: string; healthy: boolean; lastSuccess?: Date; failureRate: number; regions: { region: string; status: string; last_update: Date }[] }> {
    try {
      const records = await this.findUpdateMetadataBySource(source, undefined, transaction);
      
      if (records.length === 0) {
        return {
          source,
          healthy: false,
          failureRate: 1,
          regions: []
        };
      }

      const recentThreshold = new Date();
      recentThreshold.setHours(recentThreshold.getHours() - hoursBack);

      const recentRecords = records.filter(r => r.updated_at >= recentThreshold);
      const failedRecords = recentRecords.filter(r => r.status === 'failed');
      const successfulRecords = records.filter(r => r.status === 'success');

      return {
        source,
        healthy: failedRecords.length === 0 && successfulRecords.length > 0,
        lastSuccess: successfulRecords.length > 0 ? 
          Math.max(...successfulRecords.map(r => r.last_successful_update.getTime())) as any : undefined,
        failureRate: recentRecords.length > 0 ? failedRecords.length / recentRecords.length : 0,
        regions: records.map(r => ({
          region: r.region,
          status: r.status,
          last_update: r.last_successful_update
        }))
      };
    } catch (error) {
      throw new RepositoryError(
        `Failed to get source health status for ${source}: ${(error as Error).message}`,
        'ANALYTICS_ERROR',
        error as Error
      );
    }
  }

  async getRegionHealthStatus(region: string, hoursBack: number = 24, transaction?: Transaction): Promise<{ region: string; healthy: boolean; lastSuccess?: Date; failureRate: number; sources: { source: string; status: string; last_update: Date }[] }> {
    try {
      const records = await this.findUpdateMetadataByRegion(region, undefined, transaction);
      
      if (records.length === 0) {
        return {
          region,
          healthy: false,
          failureRate: 1,
          sources: []
        };
      }

      const recentThreshold = new Date();
      recentThreshold.setHours(recentThreshold.getHours() - hoursBack);

      const recentRecords = records.filter(r => r.updated_at >= recentThreshold);
      const failedRecords = recentRecords.filter(r => r.status === 'failed');
      const successfulRecords = records.filter(r => r.status === 'success');

      return {
        region,
        healthy: failedRecords.length === 0 && successfulRecords.length > 0,
        lastSuccess: successfulRecords.length > 0 ? 
          Math.max(...successfulRecords.map(r => r.last_successful_update.getTime())) as any : undefined,
        failureRate: recentRecords.length > 0 ? failedRecords.length / recentRecords.length : 0,
        sources: records.map(r => ({
          source: r.source,
          status: r.status,
          last_update: r.last_successful_update
        }))
      };
    } catch (error) {
      throw new RepositoryError(
        `Failed to get region health status for ${region}: ${(error as Error).message}`,
        'ANALYTICS_ERROR',
        error as Error
      );
    }
  }

  async getOverallSystemHealth(hoursBack: number = 24, transaction?: Transaction): Promise<{ healthy: boolean; totalSources: number; totalRegions: number; successRate: number; activeFailures: number }> {
    try {
      const stats = await this.getUpdateStatistics(undefined, transaction);
      const recentRecords = await this.findRecentUpdates(hoursBack, undefined, transaction);
      
      const totalRecentRecords = recentRecords.length;
      const successfulRecentRecords = recentRecords.filter(r => r.status === 'success').length;
      const activeFailures = (stats.byStatus['failed'] || 0) + (stats.byStatus['in_progress'] || 0);

      return {
        healthy: activeFailures === 0 && successfulRecentRecords > 0,
        totalSources: stats.totalSources,
        totalRegions: stats.totalRegions,
        successRate: totalRecentRecords > 0 ? successfulRecentRecords / totalRecentRecords : 0,
        activeFailures
      };
    } catch (error) {
      throw new RepositoryError(
        `Failed to get overall system health: ${(error as Error).message}`,
        'ANALYTICS_ERROR',
        error as Error
      );
    }
  }
}

// Export singleton instance
export const updateMetadataRepository = new UpdateMetadataRepository();
