// Mongoose plugin: hide the internal Mongo identifiers from serialized output.
// Applied to every model whose public identifier is a readable id, so JSON
// responses expose only the readable id (userId / conversationId / messageId)
// and never `_id` or `__v`. Mongoose runs this recursively on populated
// subdocuments, so nested references are cleaned the same way.
const hideObjectId = (schema) => {
  schema.set('toJSON', {
    versionKey: false,
    transform: (_doc, ret) => {
      delete ret._id;
      return ret;
    },
  });
};

export default hideObjectId;
