import type { MongoClient } from 'mongodb';

export function connectMongo(): Promise<MongoClient>;
export function getMongoClient(): MongoClient;