const express = require("express")
const classController = require("../controllers/class.js");
const router = express.Router();

router.post("/create-class",classController.createClass)
router.get("/class",classController.getAllClasses)
// get particular class 
router.get('/classes/:id',classController.getClass);


//update class
router.put('/classes/:id',classController.updateClass);


router.delete('/classes/:id',classController.deleteClass)
// export to exel rout
router.get("/export-class",classController.exportClassToExcel);
module.exports = router;