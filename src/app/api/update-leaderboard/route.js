export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { connectMongo, getMongoClient } from '../../../lib/connect-db';
const mongoose = require('mongoose');

export async function GET(request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    mongoose.set('strictQuery', false);
    await mongoose.connect(process.env.MONGODB_URI);
    await connectMongo()
    console.log("Connected to Database.")

    var client_db = new getMongoClient()

    var database = client_db.db("maimai");
    var players = database.collection("players")

    const friends = await players.find({}).sort({ currentRank: 1 });
  
    return NextResponse.json({ success: true, count: friends.length });
}