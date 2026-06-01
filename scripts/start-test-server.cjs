process.env.NODE_ENV = 'test';
process.env.START_SERVER = 'true';

require('../apps/api/index.js');
