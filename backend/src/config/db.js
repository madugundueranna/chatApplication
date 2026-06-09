import mongoose from 'mongoose';

const connectDB = async () => {
  mongoose.set('strictQuery', true);
  await mongoose.connect(process.env.MONGODB_URI, {
    maxPoolSize: 50,
    minPoolSize: 5,
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 10000,
  });
};

export default connectDB;
