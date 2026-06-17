const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const inboxService = require('../services/inboxService');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await inboxService.listInbox({ ...req.query, actor: req.user });
    res.json(items);
  })
);

module.exports = router;
