const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId

const { Board, Thread, Reply } = require('../models.js')
const { saveBoard, findBoard} = require('./boardHandler.js')
const { anonymizePassword, checkIfThreadDeletePasswordMatchesWithDB } = require('../encryption.js')

//----------------------------------------------------------

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

function addThreadToBoard (board, newThread) {
  board.threads.unshift(newThread)
  return board
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
      const updateAndSaveBoardPromise = addThreadAndSaveBoard(board, newThread) // function is async/await
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
  if (board.threads.length > 0) {
    board.threads.map((d, i) => {
      if(d._id == thread_id) {
        thread_index = i
      }
    })
    if(Number.isInteger(thread_index)) {
      console.log("Thread FOUND in board")
      return thread_index
    }
    else {
      console.log("Thread NOT found in board")
      return false
    }
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
      const deletePasswordMatchesPromise = verifyThreadDeletePassword (board, thread_index, delete_password)  // function is async/await
      const deletePasswordMatches = await deletePasswordMatchesPromise
      if (deletePasswordMatches) {
        const updateBoardPromise = deleteThreadAndSaveBoard (board, thread_index)  // function is async/await
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
        // thread already reported
        return board
      }
      else {
        // thread not yet reported -> report thread
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
    
    // 1. query by aggregate

    // 1.1. set aggregation pipeline stages
    const match1 = { name: board_name }
    const project1 = {
      threads: {
        reported: 0, delete_password: 0,
        replies: { reported: 0, delete_password: 0 }}
    }
    const unwind = { path: "$threads" }
    const match2 = { "threads._id": new ObjectId(thread_id) }
    const replaceRoot = { newRoot: "$threads" }

    // 1.2. construct query
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

    // 1.3. execute query
    query.exec(function(err, data) {
      if(err) { console.error(err); reject(err) }
      if(!data) { const m = 'Could NOT retrieve information from query'; console.log(m); resolve(null) }
      else {
        resolve(data) 
      }
    })
  })
}

module.exports = {
  Thread,
  createThread,
  addThreadToBoard,
  addThreadAndSaveBoard,
  findAddThreadAndSaveBoard,
  verifyThreadDeletePassword,
  deleteThreadAndSaveBoard,
  findVerifyDeleteThreadAndSaveBoard,
  findReportThreadAndSaveBoard,
  getEntireThread,

  findThreadIndexInBoard
}