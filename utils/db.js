// Database helper functions

async function query(pool, text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  
  if (process.env.NODE_ENV === 'development') {
    console.log('Executed query', { text, duration, rows: res.rowCount });
  }
  
  return res;
}

async function getOne(pool, table, id) {
  const result = await pool.query(
    `SELECT * FROM ${table} WHERE id = $1`,
    [id]
  );
  return result.rows[0];
}

async function getAll(pool, table, conditions = {}) {
  let queryText = `SELECT * FROM ${table}`;
  const params = [];
  
  if (Object.keys(conditions).length > 0) {
    const whereClauses = Object.keys(conditions).map((key, index) => {
      params.push(conditions[key]);
      return `${key} = $${index + 1}`;
    });
    queryText += ` WHERE ${whereClauses.join(' AND ')}`;
  }
  
  const result = await pool.query(queryText, params);
  return result.rows;
}

async function insert(pool, table, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
  
  const queryText = `
    INSERT INTO ${table} (${keys.join(', ')})
    VALUES (${placeholders})
    RETURNING *
  `;
  
  const result = await pool.query(queryText, values);
  return result.rows[0];
}

async function update(pool, table, id, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  
  const setClauses = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
  
  const queryText = `
    UPDATE ${table}
    SET ${setClauses}, updated_at = NOW()
    WHERE id = $${keys.length + 1}
    RETURNING *
  `;
  
  const result = await pool.query(queryText, [...values, id]);
  return result.rows[0];
}

async function deleteOne(pool, table, id) {
  const result = await pool.query(
    `DELETE FROM ${table} WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0];
}

module.exports = {
  query,
  getOne,
  getAll,
  insert,
  update,
  deleteOne,
};
