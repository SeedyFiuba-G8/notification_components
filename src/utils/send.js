const { Expo } = require('expo-server-sdk');

const expo = new Expo();

module.exports = function $send(logger) {
  return function send(messages) {
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    (async () => {
      // Send the chunks to the Expo push notification service.
      for (let chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          logger.debug('ticketChunk: ', ticketChunk);
          tickets.push(...ticketChunk);
          // NOTE: If a ticket contains an error code in ticket.details.error, you
          // must handle it appropriately. The error codes are listed in the Expo
          // documentation:
          // https://docs.expo.io/push-notifications/sending-notifications/#individual-errors
        } catch (error) {
          logger.error(`Error while sending notifications. Error: ${error}.`);
        }
      }
    })();

    let receiptIds = [];
    for (let ticket of tickets) {
      // NOTE: Not all tickets have IDs; for example, tickets for notifications
      // that could not be enqueued will have error information and no receipt ID.
      if (ticket.id) {
        receiptIds.push(ticket.id);
      } else {
        logger.error(
          `Expo returned pushTicket with error. Error: '${ticket.details.error}' Message: '${ticket.message}'`
        );
      }
    }

    let receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
    (async () => {
      for (let chunk of receiptIdChunks) {
        try {
          let receipts = await expo.getPushNotificationReceiptsAsync(chunk);
          logger.debug('receipts: ', receipts);

          // The receipts specify whether Apple or Google successfully received the
          // notification and information about an error, if one occurred.
          for (let receiptId in receipts) {
            let { status, message, details } = receipts[receiptId];
            if (status === 'ok') {
              continue;
            } else if (status === 'error') {
              logger.error(
                `There was an error sending a notification: ${message}`
              );
              if (details && details.error) {
                logger.error(`The error code is ${details.error}`);
              }
            }
          }
        } catch (error) {
          console.error(`Error while receiving pushReceipts: ${error}.`);
        }
      }
    })();
  };
};
