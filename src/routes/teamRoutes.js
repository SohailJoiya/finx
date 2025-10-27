// routes/team.routes.js
const router = require('express').Router()
const auth = require('../middleware/authMiddleware')

const ctrl = require('../controllers/teamController')

router.get('/team/overview', auth, ctrl.getTeamOverview)
router.get('/team/levels', auth, ctrl.getTeamLevels)
router.get('/team/referred', auth, ctrl.listReferredUsers)

module.exports = router
