import {initializeApp} from 'firebase-admin/app';

// Initialize Firebase Admin
initializeApp();

// Export all functions
export {updateUsers} from './updateUsers.js';
export {sendPaymentLink} from './sendPaymentLink.js';
export {handleSumUpWebhook} from './handleSumUpWebhook.js';
export {getPaymentLinkForSlackUser} from './getPaymentLinkForSlackUser.js';
