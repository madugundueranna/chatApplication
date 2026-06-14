//* Utility functions for generating prefixed, human-readable IDs.

import { ID_PREFIXES } from '../common/Constants.js';

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
const generateUserId = () => generateRandomString(ID_PREFIXES.USER);

//* Generate a Conversation ID -> CVE-XXXXXX
const generateConversationId = () => generateRandomString(ID_PREFIXES.CONVERSATION);

//* Generate a Message ID -> MSG-XXXXXX
const generateMessageId = () => generateRandomString(ID_PREFIXES.MESSAGE);

//* Generate a Call ID -> CAL-XXXXXX
const generateCallId = () => generateRandomString(ID_PREFIXES.CALL);

//* Generate a Notification ID -> NOT-XXXXXX
const generateNotificationId = () => generateRandomString(ID_PREFIXES.NOTIFICATION);

//* Generate a Status ID -> STA-XXXXXX
const generateStatusId = () => generateRandomString(ID_PREFIXES.STATUS);

//* Generate a Report ID -> REP-XXXXXX
const generateReportId = () => generateRandomString(ID_PREFIXES.REPORT);

export {
  generateUserId,
  generateConversationId,
  generateMessageId,
  generateCallId,
  generateNotificationId,
  generateStatusId,
  generateReportId,
};
