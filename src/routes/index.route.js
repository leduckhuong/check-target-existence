

const index = require('./routers/index.router');
const checkTargetExistence = require('./routers/checkTargetExistence.router');

function route(app) {
    app.use('/', index);
    app.use('/check-target-existence', checkTargetExistence);
}

module.exports = route;