const { Board, Thread, Reply } = require('../models.js')
const { saveBoard, findBoard } = require('./boardHandler.js')
const { findThreadIndexInBoard } = require('./threadHandler.js')
const { anonymizePassword, checkIfReplyDeletePasswordMatchesWithDB } = require('../encryption.js')

//----------------------------------------------------------

// REPLY
// Create Reply (Async/Await)
async function createReply (text, delete_password) {
  try {
    const anonymizePassPromise = anonymizePassword(delete_password) // function is a Promise
    const anonym_password = await anonymizePassPromise
    if(anonym_password) {
      console.log(`Reply "${text}" CREATED`)
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

function addReplyToThread (thread, newReply) {
  let updatedThread = JSON.parse(JSON.stringify(thread))
  updatedThread.bumped_on = newReply.created_on
  updatedThread.replies.unshift(newReply)
  return updatedThread
}

// (Async/Await)
async function addReplyToThreadAndSaveBoard (board, thread_index, newReply) {
  try {
    board.threads[thread_index].bumped_on = newReply.created_on
    //board.threads[thread_index].replies.push(newReply)
    board.threads[thread_index].replies.unshift(newReply)

    // 1. Make updated thread become the most recent bumped_on thread
    // 1.1. remove updated thread from threads array
    let splicedThread = board.threads.splice(thread_index, 1)[0]
    // 1.2. unshift updated thread into threads array
    board.threads.unshift(splicedThread)
    
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
      const addAndSavePromise = addReplyToThreadAndSaveBoard(board, thread_index, newReply) // function is async/await
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
    if (board.threads[thread_index].replies.length > 0) {
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
      const deletePasswordMatchesPromise = verifyReplyDeletePassword (board, thread_index, reply_index, delete_password) // function is async/await
      const deletePasswordMatches = await deletePasswordMatchesPromise
      if (deletePasswordMatches) {
        const updateBoardPromise = deleteReplyAndSaveBoard (board, thread_index, reply_index) // function is async/await
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

// THREAD AND REPLY INDEXES
function findThreadAndReplyIndexesInBoard(board, thread_id, reply_id) {
  const thread_index = findThreadIndexInBoard(board, thread_id)
  const reply_index = findReplyIndexInThreadInBoard(board, thread_id, reply_id)
  return [thread_index, reply_index]
}

module.exports = {
  Reply,
  createReply,
  addReplyToThread,
  addReplyToThreadAndSaveBoard,
  findAddReplyToThreadAndSaveBoard,
  findVerifyDeleteReplyAndSaveBoard,
  findReportReplyAndSaveBoard
}