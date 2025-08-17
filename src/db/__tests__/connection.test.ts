import testSequelize, { testConnection } from '../test-connection';

describe('Database Connection', () => {
  // For this specific test file, we do need to test the connection directly
  // But we'll rely on jest.setup.js to close the connection

  it('should connect to the database successfully', async () => {
    const connected = await testConnection();
    expect(connected).toBe(true);
  });

  it('should have the correct dialect and database name', () => {
    expect(testSequelize.getDialect()).toBe('postgres');
    expect(testSequelize.getDatabaseName().endsWith('_test')).toBe(true);
  });

  it('should have a valid connection manager', () => {
    const connectionManager = testSequelize.connectionManager;
    expect(connectionManager).toBeDefined();
    expect(typeof connectionManager.getConnection).toBe('function');
    expect(typeof connectionManager.releaseConnection).toBe('function');
  });
});
