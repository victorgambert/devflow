/**
 * API Client Utility
 */

import axios from 'axios';

const baseURL = process.env.DEVFLOW_API_URL || 'http://localhost:3000/api/v1';

export const apiClient = axios.create({
  baseURL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token if available
const token = process.env.DEVFLOW_API_TOKEN;
if (token) {
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// Add API key if available
const apiKey = process.env.DEVFLOW_API_KEY;
if (apiKey) {
  apiClient.defaults.headers.common['X-API-Key'] = apiKey;
}

