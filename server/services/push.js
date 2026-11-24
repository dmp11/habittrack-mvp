'use strict';

const webPush = require('web-push');
const config = require('../config');

function createPushService() {
  const { publicKey, privateKey, subject } = config.push;
  const enabled = Boolean(publicKey && privateKey);
  if (enabled) webPush.setVapidDetails(subject, publicKey, privateKey);

  return {
    enabled,
    publicKey: enabled ? publicKey : null,
    async send(subscription, payload) {
      if (!enabled) return { ok: false, reason: 'not-configured' };
      try {
        await webPush.sendNotification(
          { endpoint: subscription.endpoint, keys: subscription.keys },
          JSON.stringify(payload),
        );
        return { ok: true };
      } catch (error) {
        const status = error?.statusCode;
        return {
          ok: false,
          reason: status === 410 || status === 404 ? 'expired' : 'error',
          status,
        };
      }
    },
  };
}

module.exports = { createPushService };
