const express = require('express');
const router = express.Router();

// Example route for admin panel
router.get('/', (req, res) => {
    res.send('Admin Dashboard');
});

module.exports = router;
