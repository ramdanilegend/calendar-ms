import { UpdateMetadata } from '../models/test-models';
import { cleanupTestTables } from './test-helpers';

describe('UpdateMetadata Model', () => {
  // Database is already set up and managed in jest.setup.js
  // No need to open/close connections here

  // Clean up data after each test
  afterEach(async () => {
    await cleanupTestTables();
  });

  it('should create an update metadata record successfully', async () => {
    // Create test update metadata data
    const metadataData = {
      source: 'google_calendar',
      region: 'US',
      last_successful_update: new Date('2023-07-01T10:00:00Z'),
      status: 'success',
      error_details: null
    };

    // Create the update metadata in the database
    const metadata = await UpdateMetadata.create(metadataData);
    
    // Verify metadata was created with correct data
    expect(metadata).toBeDefined();
    expect(metadata.source).toBe(metadataData.source);
    expect(metadata.region).toBe(metadataData.region);
    expect(metadata.status).toBe(metadataData.status);
    expect(metadata.error_details).toBeNull();
  });

  it('should enforce unique constraint on source and region', async () => {
    // Create first metadata record
    const metadataData = {
      source: 'manual_update',
      region: 'EU',
      last_successful_update: new Date('2023-08-01T10:00:00Z'),
      status: 'success'
    };
    
    await UpdateMetadata.create(metadataData);
    
    // Attempt to create duplicate metadata (same source and region)
    try {
      await UpdateMetadata.create(metadataData);
      // If we get here, the test fails because the create should have thrown an error
      fail('Should have thrown UniqueConstraintError');
    } catch (error: any) {
      // Verify that the error is due to unique constraint violation
      expect(error.name).toBe('SequelizeUniqueConstraintError');
    }
    
    // Different region should work
    const differentRegionMetadata = {
      ...metadataData,
      region: 'APAC'
    };
    const newMetadata = await UpdateMetadata.create(differentRegionMetadata);
    expect(newMetadata).toBeDefined();
    expect(newMetadata.region).toBe('APAC');
    
    // Different source should also work
    const differentSourceMetadata = {
      ...metadataData,
      source: 'api_sync'
    };
    const anotherNewMetadata = await UpdateMetadata.create(differentSourceMetadata);
    expect(anotherNewMetadata).toBeDefined();
    expect(anotherNewMetadata.source).toBe('api_sync');
  });
  
  it('should update status and error details correctly', async () => {
    // Create initial metadata record
    const metadataData = {
      source: 'scheduled_sync',
      region: 'GLOBAL',
      last_successful_update: new Date('2023-09-01T10:00:00Z'),
      status: 'success',
      error_details: null
    };
    
    const metadata = await UpdateMetadata.create(metadataData);
    
    // Update the status to indicate a failure
    metadata.status = 'failed';
    metadata.error_details = 'Connection timeout when fetching data';
    await metadata.save();
    
    // Retrieve the updated record
    const updatedMetadata = await UpdateMetadata.findByPk(metadata.id);
    
    expect(updatedMetadata).toBeDefined();
    expect(updatedMetadata?.status).toBe('failed');
    expect(updatedMetadata?.error_details).toBe('Connection timeout when fetching data');
    
    // Update again to indicate success
    if (updatedMetadata) {
      updatedMetadata.status = 'success';
      updatedMetadata.error_details = null;
      updatedMetadata.last_successful_update = new Date('2023-09-02T10:00:00Z');
      await updatedMetadata.save();
      
      const finalMetadata = await UpdateMetadata.findByPk(metadata.id);
      
      expect(finalMetadata).toBeDefined();
      expect(finalMetadata?.status).toBe('success');
      expect(finalMetadata?.error_details).toBeNull();
      expect(finalMetadata?.last_successful_update.toDateString()).toBe(new Date('2023-09-02T10:00:00Z').toDateString());
    }
  });
});
