// Create a Mongoose document, regenerating its readable id and retrying on a
// duplicate-key collision. The model's pre('validate') hook assigns a fresh
// readable id on every attempt (the id is never part of `data`), so a retry
// simply produces a new candidate id.
const createWithRetry = async (Model, data, idField, attempts = 5) => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await Model.create(data);
    } catch (err) {
      const isIdCollision = err?.code === 11000 && err?.keyPattern?.[idField];
      if (isIdCollision && attempt < attempts) continue;
      throw err;
    }
  }
};

export default createWithRetry;
