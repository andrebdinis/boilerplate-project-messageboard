const { Board, Thread, Reply } = require('../models.js')

//----------------------------------------------------------

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
  })
}

function deleteBoard (name) {
  return new Promise((resolve, reject) => {
    Board.deleteOne( { name: name }, function(err, data) {
      if(err) reject(console.error(err))
      else {
        console.log(`Board "${name}" DELETED`)
        resolve(data)
      }
    })
  })
}

module.exports = {
  Board,
  createBoard,
  saveBoard,
  createAndSaveBoard,
  findBoard,
  getMostRecentTenBumpedThreads,
  deleteBoard
}