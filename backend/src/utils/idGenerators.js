//* Utility functions for generating prefixed, human-readable IDs.

//* Generate a random alphanumeric string -> `PREFIX-XXXXXX`
const generateRandomString = (prefix, length = 6) => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = prefix + "-";

  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return result;
};


//* Generate a User ID -> USR-XXXXXX
const generateUserId = () => generateRandomString("USR");

//* Generate a Conversation ID -> CVE-XXXXXX
const generateConversationId = () => generateRandomString("CVE");

//* Generate a Message ID -> MSG-XXXXXX
const generateMessageId = () => generateRandomString("MSG");

export { generateUserId, generateConversationId, generateMessageId };
