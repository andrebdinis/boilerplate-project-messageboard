const mongoose = require('mongoose')

// Connect to MongoDB
const db_name = "messageBoardDB"
const db = mongoose.connect(process.env.DB, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log(`Connected to database '${db_name}'`))
  .catch((err) => console.error('Could not connect to mongo DB', err));

module.exports = db