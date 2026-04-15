import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
const client = new MongoClient(uri);

let db;

async function connectDB() {
  if (!db) {
    await client.connect();
    db = client.db('vocastream');
  }
  return db;
}

function createToken(userId, email) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ 
    userId, 
    email, 
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
  }));
  const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
  const signature = btoa(secret);
  return `${header}.${payload}.${signature}`;
}

export default async function handler(req, res) {
  const { method, query } = req;
  const { action } = query;

  if (method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email, password, name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const db = await connectDB();
    const users = db.collection('users');

    if (action === 'signup') {
      if (!name) {
        return res.status(400).json({ message: 'Name is required' });
      }

      const existingUser = await users.findOne({ email });
      if (existingUser) {
        return res.status(409).json({ message: 'User already exists' });
      }

      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashedPassword = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const result = await users.insertOne({
        name,
        email,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const token = createToken(result.insertedId.toString(), email);
      
      return res.status(201).json({
        message: 'User created successfully',
        token,
        user: { id: result.insertedId.toString(), name, email }
      });
    } 
    else if (action === 'login') {
      const user = await users.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashedPassword = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      if (hashedPassword !== user.password) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = createToken(user._id.toString(), user.email);
      
      return res.status(200).json({
        message: 'Login successful',
        token,
        user: { id: user._id.toString(), name: user.name, email: user.email }
      });
    }
    
    return res.status(400).json({ message: 'Invalid action. Use ?action=signup or ?action=login' });
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}