const express = require('express');

const router = express.Router();

const upload = require('../../app/middlewares/upload');
const checkTargetExistenceController = require('../../app/controllers/CheckTargetExistence.controller');

router.post('/', upload.single('file'), checkTargetExistenceController.home);

module.exports = router;