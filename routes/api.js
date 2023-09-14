/**
 * @file api.js containing route to /api endpoint in express.js
 * @author Rachit Kataria
 * @version 1.0
 * @description DB Proxy Server
 */

const fs = require("fs");
var express = require("express");
var router = express.Router();
const sqlite3 = require("sqlite3").verbose();

const SCHEMA_LIST = []; // Store Schema's for every collection/table

// Middleware to log method, endpoint and epoch time in seconds router
if (process.env.NODE_ENV != "test") {
  router.use(async function timeLog(req, res, next) {
    console.info(
      `API Request : ${req.method} ${req.url}`,
      Math.floor(Date.now() / 1000)
    );
    next();
  });
}

// SQLite database setup
const db = new sqlite3.Database(
  "./data/samespace.db",
  sqlite3.OPEN_READWRITE,
  (err) => {
    if (err) {
      console.error(err.message);
    }
    console.log("Connected to the database.");
  }
);

// Loading Schema, Creating and Updating Tables
fs.readdirSync("./schemas").forEach((filename) => {
  if (process.env.NODE_ENV != "test" && filename == "test.json") return;
  const schema = require(`../schemas/${filename}`);
  const tableName = filename.replace(".json", "");

  SCHEMA_LIST.push({
    tableName,
    columns: Object.keys(schema),
  });

  // Schema Validation Checks
  db.serialize(() => {
    // Check if the table already exists
    db.get(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`,
      (err, row) => {
        if (err) {
          console.error(err.message);
          return;
        }

        if (!row) {
          // Table doesn't exist, so create it
          const createTableSQL = `CREATE TABLE IF NOT EXISTS ${tableName} (id INTEGER PRIMARY KEY AUTOINCREMENT, ${Object.keys(
            schema
          )
            .map((columnName) => `${columnName} ${schema[columnName]}`)
            .join(", ")})`;

          db.run(createTableSQL, (err) => {
            if (err) {
              console.error(err.message);
              return;
            }
            console.log(`Table ${tableName} created`);
          });
        } else {
          // Table exists, check and add columns if necessary
          db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
            if (err) {
              console.error(err.message);
              return;
            }

            const schColumns = Object.keys(schema);
            const dbColumns = rows.map((row) => row.name);

            // Remove duplicates
            const newColumns = schColumns.filter((x) => !dbColumns.includes(x));
            if (newColumns.length > 0) {
              // Add the new column if it doesn't exist
              const newColumnsSQL = newColumns
                .map(
                  (columnName) =>
                    `ADD COLUMN ${columnName} ${schema[columnName]}`
                )
                .join(", ");

              db.run(`ALTER TABLE ${tableName} ${newColumnsSQL}`, (err) => {
                if (err) {
                  console.error(err.message);
                  return;
                }
                console.log(
                  `Column ${newColumns.join(", ")} added to ${tableName}`
                );
              });
            }
          });
        }
      }
    );
  });
});

// define the api default
router.get("/", function (req, res) {
  res.json({
    API_Version: 1,
    status: { code: res.statusCode, message: res.statusMessage },
    available_endpoints: [
      { endpoint: "/:collection", method: "POST" },
      { endpoint: "/:collection/:id", method: "GET" },
      { endpoint: "/:collection/:id", method: "POST" },
      { endpoint: "/:collection/:id", method: "DELETE" },
    ],
  });
});

/**
 *
 * @param {string} tableName The name of the collection/table you're trying to check the validity of.
 * @param {Array[string]} columns The list of columns which you want to check matches with schema
 * @returns {Boolean}
 */
function isValidTable(tableName, columns) {
  if (columns != null) {
    if (
      columns.length !==
      SCHEMA_LIST.find((item) => item.tableName == tableName).columns.length
    ) {
      return false; // Arrays have different lengths, so they can't have all the same elements.
    }
    return columns.every((element) =>
      SCHEMA_LIST.find((item) => item.tableName == tableName).columns.includes(
        element
      )
    );
    // return columns.every(col => SCHEMA_LIST.find(item => item.tableName == tableName).columns.includes(col))
  } else
    return Boolean(SCHEMA_LIST.find((item) => item.tableName === tableName));
}

/**
 * POST Method - Create an entry.
 * @param {express.Request} req
 * @param {express.Response} res
 * @returns
 */
function createResource(req, res) {
  const { collection } = req.params;
  const { data } = req.body;

  if (!isValidTable(collection, Object.keys(data))) {
    res.status(400).json({ error: "Invalid collection name" });
    return;
  }

  const columns = Object.keys(data).join(", ");
  const values = Object.values(data)
    .map((value) => `'${value}'`)
    .join(", ");

  const insertSQL = `INSERT INTO ${collection} (${columns}) VALUES (${values})`;

  db.run(insertSQL, (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.status(201).json({ message: "Record created successfully" });
    }
  });
}

/**
 * GET Method - Read an entry.
 * @param {express.Request} req
 * @param {express.Response} res
 * @returns
 */
function readResource(req, res) {
  const { collection, id } = req.params;

  if (!isValidTable(collection)) {
    res.status(400).json({ error: "Invalid collection name" });
    return;
  }

  const selectSQL = `SELECT * FROM ${collection} where id = ${id}`;

  db.all(selectSQL, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (rows.length > 0) {
      res.status(200).json({ data: rows });
    } else {
      res.status(404).json({ error: "No Record found with that id" });
    }
  });
}

/**
 * POST Method - Update an entry.
 * @param {express.Request} req
 * @param {express.Response} res
 * @returns
 */
function updateResource(req, res) {
  const { collection, id } = req.params;
  const { data } = req.body;

  if (!isValidTable(collection)) {
    res.status(400).json({ error: "Invalid collection name" });
    return;
  }

  const selectSQL = `SELECT * FROM ${collection} where id = ${id}`;

  db.all(selectSQL, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (rows.length > 0) {
      const updateValues = Object.entries(data)
        .map(([key, value]) => `${key} = '${value}'`)
        .join(", ");
      const updateSQL = `UPDATE ${collection} SET ${updateValues} WHERE id = ${id}`;

      db.run(updateSQL, (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.status(200).json({ message: "Record updated successfully" });
        }
      });
    } else {
      res.status(404).json({ error: "No Record found with that id" });
    }
  });
}

/**
 * DELETE Method - Delete an entry.
 * @param {express.Request} req
 * @param {express.Response} res
 * @returns
 */
function deleteResource(req, res) {
  const { collection, id } = req.params;

  if (!isValidTable(collection)) {
    res.status(400).json({ error: "Invalid collection name" });
    return;
  }

  const selectSQL = `SELECT * FROM ${collection} where id = ${id}`;

  db.all(selectSQL, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (rows.length > 0) {
      // Check if any record exists with that id.
      const deleteSQL = `DELETE FROM ${collection} WHERE id = ${id}`;

      db.run(deleteSQL, (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.status(200).json({ message: "Record deleted successfully" });
        }
      });
    } else {
      res.status(404).json({ error: "No Record found with that id" });
    }
  });
}

// Defining Endpoints here
// Create
router.post("/:collection", createResource);
// Read
router.get("/:collection/:id", readResource);
// Update
router.post("/:collection/:id", updateResource);
// Delete
router.delete("/:collection/:id", deleteResource);

module.exports = router;
