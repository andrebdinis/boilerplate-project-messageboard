'use strict';

// version 1 (handlers all packed together)
//const hd = require('../controllers/handlers_v1.js')

// version 2 (handlers individualized)
const boardHandler = require('../controllers/handlers_v2/boardHandler.js')
const threadHandler = require('../controllers/handlers_v2/threadHandler.js')
const replyHandler = require('../controllers/handlers_v2/replyHandler.js')

const promisify = require('util').promisify

//----------------------------------------------------------

// Title Padding (for http requests)
const titlePadStart = 10
const titlePadEnd = titlePadStart * 2
const titlePadChar = '-'

// HTTP VS. HTTPS (process.env.httpOrHttps was created on server.js)
// - Note 1: Redirect to "http://" for the last test (10 functional tests) to pass
// - Note 2: Redirect to "https://" for the remaining tests to pass
// - Note 3: If running functional-tests with "https://" set, an error is thrown: Error: write EPROTO 140697044801472:error:1408F10B:SSL routines:ssl3_get_record:wrong version number:ssl/record/ssl3_record.c:331

//----------------------------------------------------------

module.exports = function (app) {
  
  app.route('/api/threads/:board')
    
    // CREATE THREAD (with form data: text, delete_password)
    .post((req, res) => {
      console.log(padString(' THREADS --- POST ', titlePadStart, titlePadEnd, titlePadChar))
      
      const board_name = req.params.board
      const thread_text = req.body.text
      const thread_delete_password = req.body.delete_password

      // async functions always return a promise: Promise.resolve(value)
      async function runAsyncCode () {
        try {
          const findBoardPromise = boardHandler.findBoard(board_name) // triggers promise
          let board = await findBoardPromise // 'await' unwraps the promise and gets the returned value
          if(!board) {
            // board does NOT exist -> create board
            const createBoardPromise = boardHandler.createAndSaveBoard(board_name) // triggers async function
            board = await createBoardPromise
          }
          if(board) {
            // board exists -> create and add thread to board
            const createThreadPromise = threadHandler.createThread(thread_text, thread_delete_password) // triggers promise
            const newThread = await createThreadPromise
            const createAndAddThreadPromise = threadHandler.addThreadAndSaveBoard(board, newThread) // triggers async function
            const updatedBoard = await createAndAddThreadPromise

            // send response (redirect to "/b/:board")
            const url = process.env.httpOrHttps + "://" + req.headers.host + '/b/' + board_name + '/';
            //const url = req.headers.referer
            res.redirect(url)
          }
        }
        catch (error) {
          console.error(error)
        }
      }
      runAsyncCode()//.then((value)=>console.log(value))
    })

    // RETURN ARRAY OF THE MOST RECENT 10 BUMPED THREADS ON THE BOARD WITH ONLY THE MOST RECENT 3 REPLIES FOR EACH, ALSO EXCLUDING THE FIELDS reported and delete_password (only with http parameter: board)
    .get((req, res) => {
      console.log(padString(' THREADS --- GET ', titlePadStart, titlePadEnd, titlePadChar))
      
      const board_name = req.params.board

      const runAsyncCode = async () => {
        try {
          const queryPromise = boardHandler.getMostRecentTenBumpedThreads(board_name)
          const result = await queryPromise

          const threads_length = result[0].threads.length
          if (threads_length > 0) {
            const replies_length = result[0].threads[0].replies.length
          }

          // 1. get 3 most recent replies per thread
          // 1.1. make a clean copy of threads array
          const newThreads = JSON.parse(JSON.stringify(result[0].threads))
          // 1.2. slice 3 replies per thread and assign the result to new threads
          const threeRepliesArray = result[0].threads.map((thread, i) => {
            return thread.replies.slice(0,3)
          }).map((replies, i) => newThreads[i].replies = replies )

          // send response (10 most recent bumped threads with 3 most recent replies per thread)
          res.send(newThreads)
        }
        catch (error) {
          console.error(error)
          res.end()
        }
      }
      runAsyncCode()
    })

    // DELETE THREAD (with form data: thread_id, delete_password)
    // - Returns string "incorrect password" or "success"
    .delete((req, res) => {
      console.log(padString(' THREADS --- DELETE ', titlePadStart, titlePadEnd, titlePadChar))
      
      const board_name = req.params.board
      const thread_id = req.body.thread_id
      const thread_delete_password = req.body.delete_password

      async function runAsyncCode() {
        try {
          const findBoardPromise = boardHandler.findBoard(board_name)
          const board = await findBoardPromise
          if(board) {
            // board found
            const thread_index = threadHandler.findThreadIndexInBoard(board, thread_id)
            if(Number.isInteger(thread_index)) {
              // thread found -> verify delete_password
              const verifyDeletePasswordPromise = threadHandler.verifyThreadDeletePassword (board, thread_index, thread_delete_password)
              const deletePasswordMatches = await verifyDeletePasswordPromise
              if(deletePasswordMatches) {
                // delete_password MATCHES -> delete thread and save board
                const deleteThreadSaveBoardPromise = threadHandler.deleteThreadAndSaveBoard (board, thread_index)
                const updatedBoard = await deleteThreadSaveBoardPromise
                if(updatedBoard) {
                  // thread deleted and board saved
                  console.log("Thread deleted")
                  res.send("success")
                }
                else {
                  // thread NOT deleted NOR board saved
                  console.log("Thread could NOT be deleted")
                }
              }
              else {
                // delete_password does NOT match
                console.log("Thread NOT deleted: incorrect password")
                res.send("incorrect password")
              }
            }
            else {
              // thread not found
            }
          }
          else {
            // board not found
          }
        }
        catch (error) {
          console.error(error)
          res.end()
        }
      }
      runAsyncCode()
    })

    // RETURN STRING "REPORTED" OF THREAD (with form data: report_id)
    // The reported value of the reported_id (thread's id) will be changed to true
    // - Returns string "reported"
    .put((req, res) => {
      console.log(padString(' THREADS --- PUT ', titlePadStart, titlePadEnd, titlePadChar))

      const board_name = req.params.board
      const thread_id = req.body.report_id

      async function runAsyncCode() {
        try {
          // find board
          const findBoardPromise = boardHandler.findBoard(board_name)
          const board = await findBoardPromise
          if(board) {
            // board found -> find thread, report thread, and save board
            const findReportThreadPromise = threadHandler.findReportThreadAndSaveBoard (board, thread_id)
            const updatedBoard = await findReportThreadPromise
            if(updatedBoard) {
              // thread reported successfully
              console.log("Thread reported")
              res.send("reported")
            }
            else {
              // thread NOT reported
              console.log("Thread could NOT be reported")
            }
          }
          else {
            console.log("Thread could NOT be reported")
          }
        }
        catch (error) {
          console.error(error)
          res.end()
        }
      }
      runAsyncCode()
    });
  


  
  app.route('/api/replies/:board')
    
    // CREATE REPLY (with form data: text, delete_password, thread_id)
    // - updates thread's bumped_on date to the reply's created_on date
    // - thread's replies (array) receive the newly created reply object
    .post((req, res) => {
      console.log(padString(' REPLIES --- POST ', titlePadStart, titlePadEnd, titlePadChar))

      const board_name = req.params.board
      const thread_id = req.body.thread_id
      const reply_text = req.body.text
      const reply_delete_password = req.body.delete_password
      
      // find board
      async function runAsyncCode() {
        try {
          const findBoardPromise = boardHandler.findBoard(board_name) // triggers promise
          let board = await findBoardPromise // 'await' unwraps the promise and gets the returned value
          if(!board) {
            // board does NOT exist
            return console.log("Board does NOT exist, thus NO thread exists")
          }
          else {
            // board exists -> find thread
            const thread_index = threadHandler.findThreadIndexInBoard(board, thread_id)
            if(Number.isInteger(thread_index)) {
              // thread exists -> create reply, add to thread, and save board
              const createReplyPromise = replyHandler.createReply(reply_text, reply_delete_password)
              const newReply = await createReplyPromise
              const addReplyToThreadPromise = replyHandler.addReplyToThreadAndSaveBoard (board, thread_index, newReply)
              const updatedBoard = await addReplyToThreadPromise
              //return updatedBoard

              // send response (redirect to /b/:board)
              const url = process.env.httpOrHttps + "://" + req.headers.host + '/b/' + board_name + '/' + thread_id;
              res.redirect(url)
            }
            else {
              // thread does NOT exist
              return console.log("Thread does NOT exist")
            }
          }
        }
        catch (error) {
          console.error(error)
        }
      }
      runAsyncCode()     
    })

    // RETURN ENTIRE THREAD WITH ALL ITS REPLIES, EXCLUDING THE FIELDS reported and delete_password (with http query: thread_id)
    // '/api/replies/:board?thread_id={thread_id}'
    .get((req, res) => {
      console.log(padString(' REPLIES --- GET ', titlePadStart, titlePadEnd, titlePadChar))

      const board_name = req.params.board
      const thread_id = req.query.thread_id

      async function runAsyncCode() {
        try {
          const getEntireThreadPromise = threadHandler.getEntireThread(board_name, thread_id)
          const result = await getEntireThreadPromise
          //console.log(JSON.parse(JSON.stringify(result[0])))
          const threads_length = result.length
          const replies_length = result[0].replies.length
          res.send(result[0])
        }
        catch (error) {
          console.error(error)
          res.end()
        }
      }
      runAsyncCode()
    })

    // DELETE REPLY (with form data: thread_id, reply_id, delete_password)
    // - On success, the text of the reply_id will be changed to [deleted]
    // - Returns string "incorrect password" or "success"
    .delete((req, res) => {
      console.log(padString(' REPLIES --- DELETE ', titlePadStart, titlePadEnd, titlePadChar))

      const board_name = req.params.board
      const { thread_id, reply_id } = req.body
      const reply_delete_password = req.body.delete_password

      async function runAsyncCode() {
        try {
          const findBoardPromise = boardHandler.findBoard(board_name)
          const board = await findBoardPromise
          if(board) {
            // board found -> find reply, verify delete_password, delete reply, and save board
            const findDeleteReplyPromise = replyHandler.findVerifyDeleteReplyAndSaveBoard (board, thread_id, reply_id, reply_delete_password)
            const updatedBoard = await findDeleteReplyPromise
            if(updatedBoard) {
              console.log("Reply deleted")
              res.send("success")
            }
            else {
              console.log("Reply NOT deleted")
              res.send("incorrect password")
            }
          }
          else {
            // board not found
            console.log("Reply could NOT be deleted")
          }
        }
        catch (error) {
          console.error(error)
          res.end()
        }
      }
      runAsyncCode()
    })

    // RETURN STRING "REPORTED" OF REPLY (with form data: thread_id, reply_id)
    // - Returns string "reported"
    // - The reported value of the reply_id will be changed to true.
    .put((req, res) => {
      console.log(padString(' REPLIES --- PUT ', titlePadStart, titlePadEnd, titlePadChar))
      
      const board_name = req.params.board
      const thread_id = req.body.thread_id
      const reply_id = req.body.reply_id

      async function runAsyncCode() {
        try {
          // find board, find thread, find reply, report reply, and save board
          const findBoardPromise = boardHandler.findBoard(board_name)
          const board = await findBoardPromise
          if(board) {
            const findReportReplyPromise = replyHandler.findReportReplyAndSaveBoard(board, thread_id, reply_id)
            const updatedBoard = await findReportReplyPromise
            if(updatedBoard) {
              console.log("Reply reported")
              res.send("reported")
            }
            else {
              console.log("Reply could NOT be reported")
              res.end()
            }
          }
          else {
            // board not found
            console.log("Reply could NOT be reported")
            res.end()
          }
        }
        catch (error) {
          console.error(error)
          res.end()
        }
      }
      runAsyncCode()
    });
};

//----------------------------------------------------------

// OTHER AUXILIARY FUNCTION
// Console.log Title Padding
function padString (string, padStart, padEnd, char) {
  let str = string.slice()
  let leng = str.length
  let padS = leng + padStart
  let padE = leng + padEnd
  //let padE = padStart + (leng * 2)
  return str.padStart(padS, char).padEnd(padE, char)
}
// const title = padString('TITLE OF THE YEAR', 20, 20*2, '-')