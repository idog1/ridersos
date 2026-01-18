/**
 * Base44 Client Compatibility Layer
 * 
 * This file re-exports from the new independent API client
 * to maintain backward compatibility with existing code.
 * 
 * All existing imports like:
 *   import { base44 } from '@/api/base44Client';
 * 
 * Will continue to work without changes.
 */

export { base44, auth, entities, integrations, getToken, setToken } from './client.js';
