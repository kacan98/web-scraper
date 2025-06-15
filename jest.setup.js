// jest.setup.js - Setup for Jest tests to avoid database connections
process.env.NODE_ENV = 'test';
process.env.POSTGRES_HOST = 'localhost';
process.env.POSTGRES_DB = 'test_db';
process.env.POSTGRES_USER = 'test_user';
process.env.POSTGRES_PASSWORD = 'test_password';

// Prevent actual database connections during tests
console.log('🧪 Jest test environment detected - using mock database configuration');
