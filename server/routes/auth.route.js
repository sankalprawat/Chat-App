const express = require('express')
const {signUp, login, getProfile, updateProfile, getAllContacts, imageUpload} = require('../controllers/auth.controller')
const verifyToken = require('../middleware/verifyToken.middleware')
const upload = require('../middleware/multer.middleware')
const router = express.Router()
const uploadToCloudinary = require('../middleware/cloudinary.middleware')

router.post("/signup", signUp)
router.post("/login", login)
router.get("/getProfile", verifyToken, getProfile)
router.get("/updateProfile", verifyToken, updateProfile)
router.get("/getAllContacts", verifyToken, getAllContacts)
router.post("/imageupload" , upload.single("file") ,uploadToCloudinary ,imageUpload )


module.exports = router