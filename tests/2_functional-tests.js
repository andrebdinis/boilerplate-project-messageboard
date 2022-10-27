// Mocha's TDD interface (Test-Driven Development) provides suite(), test(), suiteSetup(), suiteTeardown(), setup(), and teardown()

const chaiHttp = require('chai-http');
const chai = require('chai');
const assert = chai.assert;
const server = require('../server');

chai.use(chaiHttp);
// Documentation: https://www.chaijs.com/plugins/chai-http/

// import database handlers (to delete and load sample data for testing)
const { Board } = require('../controllers/models.js')
const boardHandler = require('../controllers/handlers_v2/boardHandler.js')
const threadHandler = require('../controllers/handlers_v2/threadHandler.js')
const replyHandler = require('../controllers/handlers_v2/replyHandler.js')

//----------------------------------------------------------
// HTTP VS. HTTPS (process.env.httpOrHttps was created on server.js)
/*// - Note 1: Redirect to "http://" for the last test (10 functional tests) to pass
// - Note 2: Redirect to "https://" for the remaining tests to pass
// - Note 3: If running functional-tests with "https://" protocol set, an error is thrown: Error: write EPROTO 140697044801472:error:1408F10B:SSL routines:ssl3_get_record:wrong version number:ssl/record/ssl3_record.c:331*/
//----------------------------------------------------------
// MOCHA TIPS:
/*// - You can use the keyword ".only" (to ONLY run one or more specific tests/suites)
// - You can use the keyword ".skip" (to SKIP one or more specific tests/suites)
// Example 1: suite.only('Title', function(){})
// Example 2: test.skip('Title', function(){})
// - this.slow(1000) makes the "standard" slow in milliseconds of a particular test or suite be of 1 second (slow appears in red, medium in yellow, fast in green)*/


suite('Functional Tests', function() {
  this.timeout(10000)
  //this.slow(5000)

  // Clean-Slate Board (empty board)
  const board_name = "ChaiTestBoard"
  const apiThreadsPath = '/api/threads/' + board_name
  const apiRepliesPath = '/api/replies/' + board_name

  // Loaded Data Sample Board (board with 10 threads, each thread with 3 replies)
  const board_name_data_sample = "ChaiDataSampleBoard"
  const apiThreadsPath_data_sample = '/api/threads/' + board_name_data_sample
  const apiRepliesPath_data_sample = '/api/replies/' + board_name_data_sample

  
  // BEFORE() HOOK (run before any test)
  // delete previous testing boards and load dummy sample data
  before(async function() {
    console.log(`Running Before() Hook...`)
    this.timeout(10000)
    process.env.httpOrHttps = "http"
   
    // delete the testing board
    await boardHandler.deleteBoard(board_name)
    await boardHandler.deleteBoard(board_name_data_sample)

    // 1. create board with 10 threads, each thread with 3 replies

    // 1.1. create 10 threads:
    let text = "Chai"
    let delete_password = "123"
    const threadPromises = []
    const replyPromises = []
    for (let i = 0; i < 10; i++) {
      const n1 = i + 1
      const newThreadPromise = threadHandler.createThread(`${text} THR ${n1}/10`, `${delete_password}${n1}`) //Async
      threadPromises.push(newThreadPromise)

      // 1.2. create 3 replies per thread:
      for (let j = 0; j < 3; j++) {
        const n2 = j + 1
        const newReplyPromise = replyHandler.createReply(`${text} REP ${n2}/3 [THR${n1}]`, `${delete_password}${n2}`) //Async
        replyPromises.push(newReplyPromise)
      }
    }

    // 2. await for all promises to come true (threads and replies)
    const threadsArray = await Promise.all(threadPromises) // 10 threads
    const repliesArray = await Promise.all(replyPromises) // 30 replies (3 per thread)

    // 3. for each thread...
    const updatedThreadsArray = []
    threadsArray.map((thread, i) => {
      const start = i * 3
      const stop = start + 3
      let updatedThread = JSON.parse(JSON.stringify(thread));
      // add 3 replies
      for (let j = start; j < stop; j++) {
        const newReply = repliesArray[j]
        updatedThread = replyHandler.addReplyToThread(updatedThread, newReply)
      }
      updatedThreadsArray.push(updatedThread)
    })

    // 4. create board
    const board = new Board({ name: board_name_data_sample })

    // 5. add each thread to board
    updatedThreadsArray.map((newThread, i) => {
      threadHandler.addThreadToBoard(board, newThread)
    })

    // 6. save board    
    await boardHandler.saveBoard(board, save_type='save')

    console.log("Before() Hook finished.\n\nBeginning Tests...\n")
  })
  
  
  // Threads Tests
  suite('Threads: Requests to /api/threads/{board}', function() {
    
    // #1 (Using board name: "ChaiTestBoard")
    test('POST: Creating a new thread', function(done) {
      this.slow(1000)
      
      const text = "Chai New Thread"
      const delete_password = "123"
      const data = {
        board: board_name,
        text: text,
        delete_password: delete_password
      }
      // create new thread
      chai.request(server)
        .post(apiThreadsPath)
        .type('form')
        .send(data)
        .end(function(err, res) {
          if(err) done(console.error(err))
          assert.equal(res.status, 200)
          assert.equal(res.type, 'text/html')

          // check if thread exists
          chai.request(server)
            .get(apiThreadsPath)
            .end(function(err, res) {
              if(err) done(console.error(err))
              assert.equal(res.status, 200)
              assert.equal(res.type, 'application/json')
              assert(Array.isArray(res.body), 'Response body should be an array')
              assert.equal(res.body[0].text, text, 'First element of response body array should have the same text value as the text sent before')
              done()
            })
        })
    })

    // #2 (Using different board name: "ChaiDataSampleBoard")
    test('GET: Viewing the 10 most recent threads with 3 replies each', function(done) {
      this.slow(500)
      
      chai.request(server)
        .get(apiThreadsPath_data_sample)
        .end(function(err, res) {
          if(err) done(console.error(err))
          assert.equal(res.status, 200)
          assert.equal(res.type, 'application/json')
          assert.isArray(res.body, 'response body should be an array')
          assert.isAtMost(res.body.length, 10, 'response body should have less than or equal to 10 elements (threads)')
          assert.isAtMost(res.body[0].replies.length, 3, "response body should have threads with less than or equal to 3 replies")
          
          let mostRecentThread = (new Date(res.body[0].created_on).getTime()) > (new Date(res.body.at(-1).created_on).getTime())
          let mostRecentReply = (new Date(res.body[0].replies[0].created_on).getTime()) > (new Date(res.body[0].replies.at(-1).created_on).getTime())
          assert.isTrue(mostRecentThread, 'response body should have its array of threads sorted by date descending order (most recent to most old)')
          assert.isTrue(mostRecentReply, 'response body should have its array of threads with its array of replies sorted by date descending order (most recent to most old)')
          done()
        })
    })

    // #3 (Using "ChaiTestBoard")
    test('DELETE with an invalid delete_password: Deleting a thread with the incorrect password', function(done) {
      this.slow(700)
      
      // get most recent thread's id
      Board.findOne({name: board_name}, function(err, boardBefore) {
        if(err) done(err)
        if(boardBefore.threads.length > 0) {
          let thread_id = boardBefore.threads[0]._id.toString()
          const data = {
            board: board_name,
            thread_id: thread_id,
            delete_password: "incorrect_password"
          }
          chai.request(server)
            .delete(apiThreadsPath)
            .type('form')
            .send(data)
            .end(function(err, res) {
              if(err) done(err)
              assert.equal(res.status, 200, 'response status should be 200')
              assert.equal(res.type, 'text/html', 'response type should be "text/html"')
              assert.equal(res.text, "incorrect password", 'response text should be "incorrect password"')
              done()
            })
        }
        else {
          assert.fail('Board\'s threads array should not be empty!')
          done()
        }
      })
    })

    // #4 (Using "ChaiTestBoard")
    test('DELETE with a valid delete_password: Deleting a thread with the correct password', function(done) {
      this.slow(1000)
      
      // get most recent thread's id
      Board.findOne({name:board_name}, function(err, boardBefore) {
        if(err) done(err)
        if(boardBefore.threads.length > 0) {
          let thread_id = boardBefore.threads[0]._id.toString()
          const data = {
            board: board_name,
            thread_id: thread_id,
            delete_password: "123"
          }
          chai.request(server)
            .delete(apiThreadsPath)
            .type('form')
            .send(data)
            .end(function(err, res) {
              if(err) done(err)
              assert.equal(res.status, 200, 'response status should be 200')
              assert.equal(res.type, 'text/html', 'response type should be "text/html"')
              assert.equal(res.text, "success", 'response text should be "success"')
    
              // now check if most recent thread was really deleted
              chai.request(server)
                .get(apiThreadsPath)
                .end(function(err, res) {
                  if(err) done(err)
                  assert.equal(res.status, 200, 'response status should be 200')
                  //assert.equal(res.type, 'application/json', 'response type should be "application/json"')
                  assert.isEmpty(res.body, 'response body (which should represent an array of threads) should now be empty (as an empty object instead) as its only thread got deleted before')
                  /*if(res.body.length > 0) {
                    assert(res.body[0]._id.toString() != thread_id, 'response body should not find the deleted thread\'s id within its array')
                  }
                  else {
                    assert(res.body.length == 0, 'response body is empty, thus did not find the deleted thread\'s id within its array')
                  }*/                
                  done()
                })
            })
        }
        else {
          assert.fail('Board\'s threads array should not be empty!')
          done()
        }
          
      })
    })

    // #5 (Using different board name: "ChaiDataSampleBoard")
    test('PUT: Reporting a thread', function(done) {
      this.slow(1000)
      
      // find board
      Board.findOne({name: board_name_data_sample}, function(err, board) {
        if(err) done(err)
        // if threads array has any thread...
        if(board.threads.length > 0) {
          // get first thread's id to report
          const reportedValueBefore = board.threads[0].reported // false
          assert.equal(reportedValueBefore, false, 'Thread\'s reported value should be false for this test to work')
          const thread_id = board.threads[0]._id.toString()

          chai.request(server)
            .put(apiThreadsPath_data_sample)
            .type('form')
            .send({
              board: board_name_data_sample,
              report_id: thread_id
            })
            .end(function(err, res) {
              if(err) done(err)
              assert.equal(res.status, 200)
              assert.equal(res.type, "text/html")
              assert.equal(res.text, 'reported')

              // now check if the thread's reported value changed to true
              Board.findOne({ name: board_name_data_sample }, function(err, boardAfter) {
                if(err) done(err)
                const reportedValueAfter = boardAfter.threads[0].reported
                assert.notStrictEqual(reportedValueAfter, reportedValueBefore, 'reported value after reporting the thread should be different than the reported value before reporting')
                assert.strictEqual(reportedValueAfter, true, 'reported value after reporting the thread should be true')
                done()
              })
            })
        }
        else {
          assert.fail('Board\'s threads array should not be empty!')
          done()
        }
      })
    })
  })

  
  // Replies Tests
  suite('Replies: Requests to /api/replies/{board}', function() {

    // #6
    test('POST: Creating a new reply', function(done) {
      this.slow(1000)
      
      // find one thread_id
      Board.findOne({name: board_name_data_sample}, function(err, board) {
        if (err) done(err)
        const thread_id = board.threads[0]._id.toString()

        // create new reply
        const reply_text = "Chai New Reply " + Math.trunc(Math.random() * 10**20)
        chai.request(server)
          .post(apiRepliesPath_data_sample)
          .type('form')
          .send({
            board: board_name_data_sample,
            thread_id: thread_id,
            text: reply_text,
            delete_password: "123"
          })
          .end(function(err, res) {
            if(err) done(err)
            assert.equal(res.status, 200)
            assert.equal(res.type, "text/html")

            // now check if the new reply exists
            // GET '/api/replies/:board?thread_id={thread_id}'
            chai.request(server)
              .get(apiRepliesPath_data_sample) // /api/replies/:board
              .query({ thread_id: thread_id }) // ?thread_id={thread_id}
              .end(function(err, res) {
                if(err) done(err)
                assert.equal(res.status, 200)
                assert.equal(res.type, 'application/json')
                assert.isObject(res.body, 'response body should be an object representing a thread')
                assert.strictEqual(res.body.replies[0].text, reply_text, 'created reply text should match with the response body replies array\'s most recent reply text')
                assert.equal(res.body.bumped_on, res.body.replies[0].created_on, 'thread\'s "bumped_on" date should match with new reply\'s "created_on" date')
                done()
              })
          })
      })
    })

    // #7
    test('GET: Viewing a single thread with all replies', function(done) {
      this.slow(800)
      
      // find one thread_id
      Board.findOne({name: board_name_data_sample}, function(err, board) {
        if (err) done(err)
        const thread_id = board.threads[0]._id.toString()

        // GET '/api/replies/:board?thread_id={thread_id}'
        chai.request(server)
          .get(apiRepliesPath_data_sample) // /api/replies/:board
          .query({ thread_id: thread_id }) // ?thread_id={thread_id}
          .end(function(err, res) {
            if(err) done(err)
            assert.equal(res.status, 200)
            assert.equal(res.type, 'application/json')
            assert.isObject(res.body, 'response body should be an object representing a thread')
            assert.property(res.body, 'text', 'response body object should have a "text" property')
            assert.property(res.body, '_id', 'response body object should have a "_id" property')
            assert.property(res.body, 'replies', 'response body object should have a "replies" property')
            assert.property(res.body, 'created_on', 'response body object should have a "created_on" property')
            assert.property(res.body, 'bumped_on', 'response body object should have a "bumped_on" property')
            assert.isArray(res.body.replies, 'property "replies" should be an array')
            done()
          })
      })
    })

    // #8
    test('DELETE with an invalid delete_password: Deleting a reply with the incorrect password', function(done) {
      this.slow(700)
      
      // find one thread_id and one reply_id
      Board.findOne({name: board_name_data_sample}, function(err, board) {
        if (err) done(err)
        const thread_id = board.threads[0]._id.toString()
        const reply_id = board.threads[0].replies[0]._id.toString()

        chai.request(server)
          .delete(apiRepliesPath_data_sample)
          .type('form')
          .send({
            board: board_name_data_sample,
            thread_id: thread_id,
            reply_id: reply_id,
            delete_password: "incorrect_password"
          })
          .end(function(err, res) {
            if (err) done(err)
            assert.equal(res.status, 200)
            assert.equal(res.type, 'text/html')
            assert.equal(res.text, 'incorrect password')
            done()
          })
      })
    })

    // #9
    test('DELETE with a valid delete_password: Deleting a reply with the correct password', function(done) {
      this.slow(1000)
      
      // find one thread_id and one reply_id
      Board.findOne({name: board_name_data_sample}, function(err, board) {
        if (err) done(err)
        const thread_id = board.threads[0]._id.toString()
        const reply_id = board.threads[0].replies[0]._id.toString()
        const replyTextBeforeDeleted = board.threads[0].replies[0].text

        chai.request(server)
          .delete(apiRepliesPath_data_sample)
          .type('form')
          .send({
            board: board_name_data_sample,
            thread_id: thread_id,
            reply_id: reply_id,
            delete_password: "123"
          })
          .end(function(err, res) {
            if (err) done(err)
            assert.equal(res.status, 200)
            assert.equal(res.type, 'text/html')
            assert.equal(res.text, 'success')

            // now check if the reply was deleted
            chai.request(server)
              .get(apiRepliesPath_data_sample)
              .query({ thread_id: thread_id })
              .end(function(err, res) {
                if (err) done(err)
                assert.equal(res.status, 200)
                assert.equal(res.type, 'application/json')
                assert.equal(res.body.replies[0]._id.toString(), reply_id, 'most recent deleted reply id should match (the same) with most recent reply id in database')
                assert.notEqual(res.body.replies[0].text, replyTextBeforeDeleted, 'most recent reply text BEFORE deletion should not match with most recent reply text AFTER deletion')
                assert.equal(res.body.replies[0].text, '[deleted]', 'most recent deleted reply should have its "text" property equal to "[deleted]"')
                done()
              })
          })
      })
    })

    // #10
    test('PUT: Reporting a reply', function(done) {
      this.slow(1000)
      
      // find one thread_id and one reply_id
      Board.findOne({name: board_name_data_sample}, function(err, board) {
        if (err) done(err)
        const thread_id = board.threads[0]._id.toString()
        const reply_id = board.threads[0].replies[0]._id.toString()
        const replyBeforeReported = board.threads[0].replies[0].reported

        chai.request(server)
          .put(apiRepliesPath_data_sample)
          .type('form')
          .send({
            board: board_name_data_sample,
            thread_id: thread_id,
            reply_id: reply_id
          })
          .end(function(err, res) {
            if (err) done(err)
            assert.equal(res.status, 200)
            assert.equal(res.type, 'text/html')
            assert.equal(res.text, 'reported')

            // now check if the reply was reported
            // (must get the board once again to see if the change was done)
            Board.findOne({name: board_name_data_sample}, function(err, boardTwo) {
              if (err) done(err)
              const reply = JSON.parse(JSON.stringify(boardTwo.threads[0].replies[0]))
              assert.equal(boardTwo.threads[0].replies[0]._id.toString(), reply_id, 'most recent reported reply id should match with most recent reported reply id in database')
              assert.notEqual(boardTwo.threads[0].replies[0].reported, replyBeforeReported, 'most recent reply\'s "reported" value BEFORE reporting should not match with most recent reply "reported" value in database AFTER reporting')
              assert.equal(boardTwo.threads[0].replies[0].reported, true, 'most recent reply\'s "reported" value should be equal to "true"')
              done()
            })
          })
      })
    })
  })

  
  // AFTER() HOOK (after all tests run this code)
  after(function(done) {
    process.env.httpOrHttps = "https";
    done()
  })
});
