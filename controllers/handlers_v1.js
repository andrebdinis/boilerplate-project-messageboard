//'use strict';
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId

const bcrypt = require ('bcrypt')
const saltRounds = 10
// *Must encrypt any password field (delete_password)

const { Board, Thread, Reply } = require('./models.js')

//----------------------------------------------------------
// DB FUNCTIONS/METHODS

// BOARD
// Create Board
function createBoard (name) {
  return new Board({ name: name })
}
// (Promise)
function saveBoard (board, save_type='save') { // save_type: "save" or "update"
  return new Promise((resolve, reject) => {
    board.save(function(err, data) {
      if(err) { console.error(err); reject(err) }
      if(!data) { const m = `Board "${board.name}" NOT ${save_type.toUpperCase()}D in db`; console.log(m); resolve(null) }
      else {
        console.log(`Board "${data.name}" ${save_type.toUpperCase()}D in db`)
        resolve(data)
      }
    })
  })
}
// (Async/Await)
async function createAndSaveBoard (name) {
  try {
    const board = createBoard(name)
    const saveBoardPromise = saveBoard(board) // function is a Promise
    const savedBoard = await saveBoardPromise
    return savedBoard
  }
  catch (error) {
    console.error(error)
  }
}

// Find Board (Promise)
function findBoard (board_name) {
  return new Promise((resolve, reject) => {
    Board.findOne({ name: board_name }, function(err, data) {
      if(err) { console.error(err); reject(err) }
      if(!data) { const m = `Board "${board_name}" NOT found in db`; console.log(m); resolve(null) }
      else {
        console.log(`Board "${data.name}" FOUND in db`)
        resolve(data)
      }
    })
  })
}

// GET /api/threads/:board (Promise)
// "Returned will be an array of the most recent 10 bumped threads on the board with only the most recent 3 replies for each. The reported and delete_password fields will not be sent to the client."
function getMostRecentTenBumpedThreads (board_name) {
  return new Promise((resolve, reject) => {

    // query by aggregate

    // set aggregation pipeline stages
    const match = { name: board_name }
    const project = {
      name: "$name",
      threads: { $slice: ["$threads", 10] },
      created_on: "$created_on"
    }
    const unset = [ "threads.reported", "threads.delete_password",
        "threads.replies.reported", "threads.replies.delete_password" ]

    // query
    const query = Board.aggregate(
      [
        {
          $match: match // find board
        },
        {
          $project: project // slice 10 most recent bumped_on threads
        },
        {
          $unset: unset // remove "reported" and "delete_password" fields from threads array and replies array
        }
      ]
    )

    // execute query
    query.exec(function(err, data) {
      if(err) { console.error(err); reject(err) }
      if(!data) { const m = 'Could NOT retrieve information from query'; console.log(m); resolve(null) }
      else {
        resolve(data) 
      }
    })


    // query normally
    /*const filter = { name: board_name }
    const projection = {
      threads: {
        reported:0,
        delete_password:0,
        replies: { reported:0, delete_password:0  }
      }
    }
    //const query = Board
      //.find(filter)
      //.slice('threads', 10) // slice messes up with the projection
      //.find(filter, projection)
      //.slice('threads', 3)
      //.sort()
      //.limit()
      //.select()*/
    
    /*//Thread.find({}) // find all threads
    //Thread.find({ 'replies.created_on': { $sort: -1, $limit: 3 } })
    const query2 = 
      Thread.find({})
      .sort('-bumped_on -replies.created_on') // sort by date descending order (most recent to oldest) and sort by most recent replies inside each thread
      .limit(10) // only up to 10 threads
      //.sort('-replies.created_on')
      .where('replies').slice(3)
      .select('-reported -delete_password')
      
    query2.exec(function(err, data) {
      if(err) return console.error(err)
      if(!data) return console.log('0 threads found')
      console.log(data)
      //for await (const doc of Model.find([{ $sort: { name: 1 } }])) {
      //  console.log(doc.name);
      //}
      return data
    })*/
  })
}



// THREAD
// Create Thread (Async/Await)
async function createThread (text, delete_password) {
  try {
    const anonymizePassPromise = anonymizePassword(delete_password) // function is a Promise
    const anonym_password = await anonymizePassPromise
    if(anonym_password) {
      console.log(`Thread "${text}" CREATED`)
      return new Thread({
        text: text,
        delete_password: anonym_password
      })
    }
    else {
      console.log(`Thread "${text}" NOT created`)
    }      
  }
  catch (error) {
    console.error(error)
  }
    
}
// (Async/Await)
async function addThreadAndSaveBoard (board, newThread) {
  try {
    //board.threads.push(newThread)
    board.threads.unshift(newThread)
    const saveUpdatedBoardPromise = saveBoard(board, save_type='update') // function is a Promise
    const updatedBoard = await saveUpdatedBoardPromise
    return updatedBoard
  }
  catch (error) {
    console.error(error)
  }
}
// (Async/Await)
async function findAddThreadAndSaveBoard (board_name, newThread) {
  try {
    // Find board
    const findBoardPromise = findBoard(board_name) // function is a Promise
    const board = await findBoardPromise
    if(board) {
      // Update (add thread) and save board
      const updateAndSaveBoardPromise = addThreadAndSaveBoard(board, newThread) // function is async/await ---- WILL THERE BE PROBLEMS !?
      const updatedBoard = await updateAndSaveBoardPromise
      return updatedBoard // return Promise.resolve(updatedBoard)
    }
    return board
  }
  catch (error) {
    console.error(error) // return Promise.resolve(undefined)
  } 
}

// Find Thread (index)
function findThreadIndexInBoard (board, thread_id) {
  let thread_index = false;
  board.threads.map((d, i) => {
    //console.log(d, i)
    if(d._id == thread_id) {
      thread_index = i
    }
  })
  //console.log("INDEX:",index)
  if(Number.isInteger(thread_index)) {
    console.log("Thread FOUND in board")
    return thread_index
  }
  else {
    console.log("Thread NOT found in board")
    return false
  }
}

// Delete Thread (Async/Await)
async function verifyThreadDeletePassword (board, thread_index, delete_password) {
  try {
    const deletePassMatchesPromise = checkIfThreadDeletePasswordMatchesWithDB(board, thread_index, delete_password) // function is a Promise
    const deletePassMatches = await deletePassMatchesPromise
    if(deletePassMatches) {
      console.log("Thread's delete_password MATCHES")
      return true
    }
    else {
      console.log("Thread's delete_password does NOT match")
      return false
    } 
  }
  catch (error) {
    console.error(error)
  }
}
// (Async/Await)
async function deleteThreadAndSaveBoard (board, thread_index) {
  try {
    board.threads[thread_index].remove() // subdocument becomes null
    const saveBoardPromise = saveBoard(board, save_type='update') // function is a Promise
    const savedBoard = await saveBoardPromise // parent saved, subdoc removed!
    return savedBoard
  }
  catch (error) {
    console.error(error)
  }
}
// (Async/Await) 
async function findVerifyDeleteThreadAndSaveBoard (board, thread_id, delete_password) {
  try {
    const thread_index = findThreadIndexInBoard(board, thread_id)
    if(Number.isInteger(thread_index)) {
      const deletePasswordMatchesPromise = verifyThreadDeletePassword (board, thread_index, delete_password)  // function is async/await ---- WILL THERE BE PROBLEMS !?
      const deletePasswordMatches = await deletePasswordMatchesPromise
      if (deletePasswordMatches) {
        const updateBoardPromise = deleteThreadAndSaveBoard (board, thread_index)  // function is async/await ---- WILL THERE BE PROBLEMS !?
        const updatedBoard = await updateBoardPromise
        return updatedBoard
      }
      else {
        return false
      }
    }
    else {
      return false
    }
  }
  catch (error) {
    console.error(error)
  }
}

// Report Thread (Async/Await)
async function findReportThreadAndSaveBoard (board, thread_id) {
  try {
    const thread_index = findThreadIndexInBoard (board, thread_id)
    if (Number.isInteger(thread_index)) {
      if(board.threads[thread_index].reported === true) {
        // already reported
        return board
      }
      else {
        // not yet reported -> report thread
        board.threads[thread_index].reported = true
        const saveUpdatedBoardPromise = saveBoard(board, save_type='update') // function is a Promise
        const updatedBoard = await saveUpdatedBoardPromise
        return updatedBoard
      }
    }
    else {
      return false
    }
  }
  catch (error) {
    console.error(error)
  }
}

// GET /api/replies/:board?thread_id={thread_id} (Promise)
// "Returned will be the entire thread with all its replies. The reported and delete_password fields will not be sent to the client."
function getEntireThread (board_name, thread_id) {
  
  return new Promise((resolve, reject) => {
    
    // query by aggregate

    // set aggregation pipeline stages
    const match1 = { name: board_name }
    const project1 = {
      threads: {
        reported: 0, delete_password: 0,
        replies: { reported: 0, delete_password: 0 }}
    }
    const unwind = { path: "$threads" }
    const match2 = { "threads._id": new ObjectId(thread_id) }
    const replaceRoot = { newRoot: "$threads" }

    // query
    const query = Board.aggregate(
      [
        {
          $match: match1 // find and filter board
        },
        {
          $project: project1 // remove "reported" and "delete_password" fields from threads array and replies array
        },
        {
          $unwind: unwind // unwind "threads" so that we can obtain the "thread" we want in the next match
        },
        {
          $match: match2 // find and filter thread
        },
        {
          $replaceRoot: replaceRoot // set thread as "root" (instead of board)
        }
      ]
    );

    // execute query
    query.exec(function(err, data) {
      if(err) { console.error(err); reject(err) }
      if(!data) { const m = 'Could NOT retrieve information from query'; console.log(m); resolve(null) }
      else {
        resolve(data) 
      }
    })
  })
}



// REPLY
// Create Reply (Async/Await)
async function createReply (text, delete_password) {
  try {
    const anonymizePassPromise = anonymizePassword(delete_password) // function is a Promise
    const anonym_password = await anonymizePassPromise
    if(anonym_password) {
      console.log(`Reply created`)
      return new Reply({
        text: text,
        delete_password: anonym_password
      })
    }
    else {
      console.log(`Reply NOT created`)
    }
  }
  catch (error) {
    console.error(error)
  }
}
// (Async/Await)
async function addReplyToThreadAndSaveBoard (board, thread_index, newReply) {
  try {
    board.threads[thread_index].bumped_on = newReply.created_on
    //board.threads[thread_index].replies.push(newReply)
    board.threads[thread_index].replies.unshift(newReply)
    const saveUpdatedBoardPromise = saveBoard(board, save_type='update') // function is a Promise
    const updatedBoard = await saveUpdatedBoardPromise
    return updatedBoard
  }
  catch (error) {
    console.error(error)
  }
}
// (Async/Await)
async function findAddReplyToThreadAndSaveBoard (board, thread_id, newReply) {
  try {
    // Find thread
    const thread_index = findThreadIndexInBoard (board, thread_id)
    if (Number.isInteger(thread_index)) {
      const addAndSavePromise = addReplyToThreadAndSaveBoard(board, thread_index, newReply) // function is async/await ---- WILL THERE BE PROBLEMS !?
      const updatedBoard = await addAndSavePromise
      return updatedBoard
    }
    return false
  }
  catch (error) {
    console.error(error)
  }
}

// Find Reply (index)
function findReplyIndexInThreadInBoard (board, thread_id, reply_id) {
  const thread_index = findThreadIndexInBoard(board, thread_id)
  if(Number.isInteger(thread_index)) {
    let reply_index = false
    board.threads[thread_index].replies.map((d, i) => {
      if(d._id == reply_id) {
        reply_index = i
      }
    })
    if(Number.isInteger(reply_index)) {
      console.log("Reply FOUND in thread in board")
      return reply_index
    }
    else {
      console.log("Reply NOT found in thread in board")
      return false
    }
  }
  else {
    // thread not found
  }
    
}

// Delete Reply (Async/Await)
async function verifyReplyDeletePassword (board, thread_index, reply_index, delete_password) {
  try {
    const deletePassMatchesPromise = checkIfReplyDeletePasswordMatchesWithDB(board, thread_index, reply_index, delete_password) // function is a Promise
    const deletePassMatches = await deletePassMatchesPromise
    if(deletePassMatches) {
      console.log("Reply's delete_password MATCHES")
      return true
    }
    else {
      console.log("Reply's delete_password does NOT match")
      return false
    }
  }
  catch (error) {
    console.error(error)
  }
}
// (Async/Await)
async function deleteReplyAndSaveBoard (board, thread_index, reply_index) {
  try {
    //board.threads[thread_index].replies[reply_index].remove() // subdocument becomes null
    board.threads[thread_index].replies[reply_index].text = "[deleted]"
    const saveBoardPromise = saveBoard(board, save_type='update') // function is a Promise
    const savedBoard = await saveBoardPromise // parent saved, subdoc removed!
    return savedBoard
  }
  catch (error) {
    console.error(error)
  }
}
// (Async/Await)
async function findVerifyDeleteReplyAndSaveBoard (board, thread_id, reply_id, delete_password) {
  try {
    const [thread_index, reply_index] = findThreadAndReplyIndexesInBoard(board, thread_id, reply_id)
    if(Number.isInteger(thread_index) && Number.isInteger(reply_index)) {
      const deletePasswordMatchesPromise = verifyReplyDeletePassword (board, thread_index, reply_index, delete_password) // function is async/await ---- WILL THERE BE PROBLEMS !?
      const deletePasswordMatches = await deletePasswordMatchesPromise
      if (deletePasswordMatches) {
        const updateBoardPromise = deleteReplyAndSaveBoard (board, thread_index, reply_index) // function is async/await ---- WILL THERE BE PROBLEMS !?
        const updatedBoard = await updateBoardPromise
        return updatedBoard
      }
      else {
        return false
      }
    }
    else {
      return false
    }
  }
  catch (error) {
    console.error(error)
  }
}

// Report Reply (Async/Await)
async function findReportReplyAndSaveBoard (board, thread_id, reply_id) {
  try {
    const [thread_index, reply_index] = findThreadAndReplyIndexesInBoard(board, thread_id, reply_id)
    if (Number.isInteger(thread_index) && Number.isInteger(reply_index)) {
      board.threads[thread_index].replies[reply_index].reported = true
      const saveUpdatedBoardPromise = saveBoard(board, save_type='update') // function is a Promise
      const updatedBoard = await saveUpdatedBoardPromise
      return updatedBoard
    }
    else {
      return false
    }
  }
  catch (error) {
    console.error(error)
  }
}



// THREAD AND REPLY
function findThreadAndReplyIndexesInBoard(board, thread_id, reply_id) {
  const thread_index = findThreadIndexInBoard(board, thread_id)
  const reply_index = findReplyIndexInThreadInBoard(board, thread_id, reply_id)
  return [thread_index, reply_index]
}



//----------------------------------------------------------------
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
  Board,
  createBoard,
  createAndSaveBoard,
  findBoard,
  getMostRecentTenBumpedThreads,

  Thread,
  createThread,
  addThreadAndSaveBoard,
  findAddThreadAndSaveBoard,
  verifyThreadDeletePassword,
  deleteThreadAndSaveBoard,
  findVerifyDeleteThreadAndSaveBoard,
  findReportThreadAndSaveBoard,
  getEntireThread,

  Reply,
  createReply,
  addReplyToThreadAndSaveBoard,
  findAddReplyToThreadAndSaveBoard,
  findVerifyDeleteReplyAndSaveBoard,
  findReportReplyAndSaveBoard,

  findThreadIndexInBoard,
  findReplyIndexInThreadInBoard,
  findThreadAndReplyIndexesInBoard
}
