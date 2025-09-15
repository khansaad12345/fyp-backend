const mongoose = require("mongoose")
require('dotenv').config();

const connectDB = async()=>{
    try {
        const url = "mongodb://127.0.0.1:27017/attendanceDB"
        // const url = `mongodb://saadullah:Naxy6xUso4Qhma6R@attendance-shard-00-00.kz7o1.mongodb.net:27017,attendance-shard-00-01.kz7o1.mongodb.net:27017,attendance-shard-00-02.kz7o1.mongodb.net:27017/?ssl=true&replicaSet=atlas-80dwrb-shard-0&authSource=admin&retryWrites=true&w=majority&appName=attendance`;
        const conn = await mongoose.connect(url);
       
        console.log("mongo db connected")
    } catch (error) {
        console.log("error connection to Mongo db", error.message)
        process.exit(1)
    }
}
module.exports = connectDB;
