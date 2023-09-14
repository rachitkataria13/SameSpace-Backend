/**
 * @file server.js containing main express server logic
 * @author Rachit Kataria
 * @version 1.0
 * @description DB Proxy Server
 */

const express = require("express");
const bodyParser = require("body-parser");
const api = require("./routes/api");

const app = express();
const PORT = 3000;

app.use(bodyParser.json()); // To get body data as parsed json.

app.use("/api", api);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app