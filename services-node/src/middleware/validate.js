const zod = require('zod');

function validate(schema, data, type) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return {
      success: false,
      message: 'Validasi gagal',
      data: null,
      meta: null,
      errors,
      request_id: null,
    };
  }
  return { success: true, data: result.data, errors: null };
}

function handler(req, res, next) {
  const { body, query, params } = req;
  const results = [];

  if (schema.body) {
    const bodyResult = validate(schema.body, body, 'body');
    if (!bodyResult.success) {
      return res.status(422).json(bodyResult);
    }
    results.push(bodyResult.data);
  } else {
    results.push(req.body);
  }

  if (schema.query) {
    const queryResult = validate(schema.query, query, 'query');
    if (!queryResult.success) {
      return res.status(422).json(queryResult);
    }
    results.push(queryResult.data);
  } else {
    results.push(req.query);
  }

  if (schema.params) {
    const paramsResult = validate(schema.params, params, 'params');
    if (!paramsResult.success) {
      return res.status(422).json(paramsResult);
    }
    results.push(paramsResult.data);
  } else {
    results.push(req.params);
  }

  req.validated = {
    body: results[0],
    query: results[1] || {},
    params: results[2] || {},
  };
  next();
}

module.exports = { validate, handler };
module.exports.zod = zod;