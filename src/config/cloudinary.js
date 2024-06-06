const coludinary = require("cloudinary").v2;

coludinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_APIS_SECRET,
  secure: true,
});

module.exports = coludinary;
