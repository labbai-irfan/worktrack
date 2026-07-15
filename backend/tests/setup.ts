import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://placeholder:27017/test'; // replaced by memory server
process.env.JWT_ACCESS_SECRET = 'test-access-secret-test-access-secret-1234';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-test-refresh-secret-1234';
process.env.LOG_LEVEL = 'silent';

let mongo: MongoMemoryServer | null = null;

export async function startTestDb(): Promise<string> {
  mongo = await MongoMemoryServer.create();
  return mongo.getUri('worktrack-test');
}

export async function stopTestDb(): Promise<void> {
  if (mongo) await mongo.stop();
}
