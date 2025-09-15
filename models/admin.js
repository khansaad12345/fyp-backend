const mongoose = require("mongoose");
const validator = require("validator");
const bcryptjs = require("bcryptjs");

const adminSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Please provide a username"],
            trim: true,
            minlength: 3,
            maxlength: 26,
            index: true,
        },
        email: {
            type: String,
            required: [true, "Please provide an email"],
            unique: true,
            validate: [validator.isEmail, "Please provide a valid email"],
        },
        password: {
            type: String,
            required: [true, "Please provide a password"],
            minlength: 8,
            select: false,
        },
        role: { type: String, default: 'admin', enum: ['admin'] },
    },
    { timestamps: true }
);

adminSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();

    // Hash the password
    this.password = await bcryptjs.hash(this.password, 10);

    next();
});


adminSchema.methods.correctPassword = async function (password,userPassword) {
    console.log('check password')
    return await bcryptjs.compare(password,userPassword)
}

const Admin = mongoose.model("Admin", adminSchema);

module.exports = Admin;

