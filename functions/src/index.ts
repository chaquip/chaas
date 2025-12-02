import {initializeApp} from 'firebase-admin/app';

// Initialize Firebase Admin
initializeApp();

// Export all functions
export {updateUsers} from './updateUsers.js';
