import mongoose from 'mongoose';

const connectDB = async () => {
  mongoose.set('strictQuery', true);

  // Atlas drops idle TLS sockets, which surfaces as a connection 'error'. Without
  // a listener that event throws and crashes the process; the driver reconnects on
  // its own, so we just log and let it recover.
  const { connection } = mongoose;
  connection.on('error', (err) => console.error(`[mongo] ${err.code || err.message}`));
  connection.on('disconnected', () => console.warn('[mongo] disconnected — retrying'));
  connection.on('reconnected', () => console.info('[mongo] reconnected'));

  await mongoose.connect(process.env.MONGODB_URI, {
    maxPoolSize: 50,
    minPoolSize: 5,
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 10000,
  });
};

export default connectDB;
