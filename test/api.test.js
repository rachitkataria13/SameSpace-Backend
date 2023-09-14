//During the test the env variable is set to test
process.env.NODE_ENV = 'test';

// test.js
const sqlite3 = require('sqlite3').verbose();
const chai = require('chai');
const chaiHttp = require('chai-http');
const app = require('../server');

chai.use(chaiHttp);
const expect = chai.expect;

// Establish connection to SQLite DB
const db = new sqlite3.Database('./data/samespace.db', sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error(err.message);
  }
});

describe('API Tests', () => {
  before((done) => {
    // Delete the table schema
    db.run(`drop table if exists test`, (err) => {
      if(err){
        console.error(err)
        return;
      }
    });

    // Import the schema for test collection
    const schema = require(`../schemas/test.json`);
    const createTableSQL = `CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY AUTOINCREMENT, 
      ${Object.keys(schema).map((columnName) => `${columnName} ${schema[columnName]}`)
      .join(", ")})`;

    db.run(createTableSQL, (err) => {
      if (err) {
        console.error(err.message);
        return;
      }
    });
    
    done();
  })
  // Test for POST /test
  it('should create a new collection item', (done) => {
    chai
      .request(app)
      .post('/api/test')
      .send({ 
        data: { 
          name: "Rachit",
          phone: "9876543210",
          email: "user@domain.tld",
          location: "India"
        }
      })
      .end((err, res) => {
        expect(res).to.have.status(201);
        expect(res.body).to.be.an('object');
        expect(res.body).to.have.property('message', 'Record created successfully');
        done();
      });
  });

  // Test for GET /test/:id
  it('should retrieve an existing collection item', (done) => {
    chai
      .request(app)
      .get('/api/test/1')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body).to.be.an('object');
        expect(res.body.data).to.be.an('array');
        done();
      });
  });

  // Test for POST /test/:id
  it('should update an existing collection item', (done) => {
    chai
      .request(app)
      .post(`/api/test/1`)
      .send({ 
        data: { 
          phone: "1234567890",
        }
        })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body).to.be.an('object');
        expect(res.body).to.have.property('message', 'Record updated successfully');
        done();
      });
  });

  // Test for DELETE /test/:id
  it('should delete an existing collection item', (done) => {
    chai
      .request(app)
      .delete(`/api/test/1`)
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body).to.be.an('object');
        expect(res.body).to.have.property('message', 'Record deleted successfully'); // Check the response data if needed
        done();
      });
  });

  after((done) => {
    // Delete the table schema
    db.run(`drop table if exists test`, (err) => {
      if(err){
        console.error(err)
        return;
      }
    });
    done();
  })
});
