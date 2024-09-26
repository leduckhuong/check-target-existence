const express = require('express');
const router = express.Router();
const indexController = require('../../app/controllers/Index.controller');

router.get('/', indexController.home);

module.exports = router;