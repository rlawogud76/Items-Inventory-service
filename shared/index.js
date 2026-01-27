// Shared module exports
const database = require('./database');
const models = require('./models');
const services = require('./services');
const constants = require('./constants');

module.exports = {
  // Database
  ...database,
  
  // Models
  ...models,
  
  // Services
  ...services,
  
  // Constants
  ...constants
};
