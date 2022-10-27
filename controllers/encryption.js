const bcrypt = require ('bcrypt')
const saltRounds = 10

//----------------------------------------------------------

// BCRYPT STUFF

// Slice Hash string into a more readable format
function sliceHash(hash) {
  return hash.slice(hash.length-31, hash.length)
}

// Anonymize/Encrypt password into a hash (Promise)
function anonymizePassword(password) {
  return new Promise((resolve, reject) => {
    bcrypt.genSalt(saltRounds, function(err, salt) {
      if(err) { console.error(err); reject(err) }
      bcrypt.hash(password, salt, function(err, hash) {
        if(err) { console.error(err); reject(err) }
        resolve(hash)
      })
    })
  })
}

// Thread "delete_password" matches with encrypted hash in db? (Promise)
function checkIfThreadDeletePasswordMatchesWithDB(board, thread_index, delete_password) {
  return new Promise((resolve, reject) => {
    const hashed_pass_in_db = board.threads[thread_index].delete_password
    bcrypt.compare(delete_password, hashed_pass_in_db, function(err, match) {
      if(err) { console.error(err); reject(err) }
      if(match) {
        resolve(true)
      }
      else {
        resolve(false)
      }
    })
  })
}

// Reply "delete_password" matches with encrypted hash in db? (Promise)
function checkIfReplyDeletePasswordMatchesWithDB(board, thread_index, reply_index, delete_password) {
  return new Promise((resolve, reject) => {
    const hashed_pass_in_db = board.threads[thread_index].replies[reply_index].delete_password
    bcrypt.compare(delete_password, hashed_pass_in_db, (err, match) => {
      if(err) { console.error(err); reject(err) }
      if(match) {
        resolve(true)
      }
      else {
        resolve(false)
      } 
    })
  })
}

module.exports = {
  sliceHash,
  anonymizePassword,
  checkIfThreadDeletePasswordMatchesWithDB,
  checkIfReplyDeletePasswordMatchesWithDB
}