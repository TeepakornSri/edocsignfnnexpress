const Joi = require("joi");

const checkContentId = Joi.object({
  productId: Joi.number().integer().positive().required(),
});

exports.checkContentId = checkContentId;
